const Call = require('../model/Call');
const User= require('../model/UserAuth');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid'); // Import uuid for generating unique identifiers
const admin = require('firebase-admin');
const serviceAccount = require('../middleware/serviceAccountKey.json');
const mongoose = require('mongoose');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

exports.createRoom = async (req, res) => {
  const { name } = req.body;

  try {
    // Create JWT token with jti claim
    const token = jwt.sign(
      { 
        access_key: process.env.HMS_ACCESS_KEY, 
        jti: uuidv4() // Add a unique identifier to the token
      }, 
      process.env.HMS_SECRET_KEY, 
      { expiresIn: '1h' } // Token expiration
    );

    const response = await axios.post(
      'https://api.100ms.live/v2/rooms',
      { name },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    console.log('Room creation response:', response.data);
    res.status(200).json(response.data);
  } catch (err) {
    console.error('Error creating room:', err.response ? err.response.data : err.message);
    res.status(500).json({ error: 'Failed to create room: ' + (err.response ? err.response.data : err.message) });
  }
};



exports.generateToken = async (req, res) => {
    const { user_id, room_id, role } = req.body;
  
    try {

      const token = jwt.sign(
        {
          access_key: process.env.HMS_ACCESS_KEY,
          room_id,
          user_id,
          role: role, 
          type: 'app',
          version: 2,
          jti: uuidv4() 
        },
        process.env.HMS_SECRET_KEY,
        { expiresIn: '24h' } 
      );
  
      res.json({ token });
    } catch (err) {
      console.error('Error generating token:', err);
      res.status(500).json({ error: 'Failed to generate token: ' + err.message });
    }
  };

  exports.startCall = async (req, res) => {
    const { callerId, guestId, roomName } = req.body;
  
    try {
      if (!mongoose.Types.ObjectId.isValid(callerId) || !mongoose.Types.ObjectId.isValid(guestId)) {
        return res.status(400).json({ error: 'Invalid callerId or guestId' });
      }
  
      // Generate a JWT token for 100ms API
      const token = jwt.sign(
        {
          access_key: process.env.HMS_ACCESS_KEY,
          jti: uuidv4(),
        },
        process.env.HMS_SECRET_KEY,
        { expiresIn: '1h' }
      );
  
      // Create the room on 100ms platform
      const response = await axios.post(
        'https://api.100ms.live/v2/rooms',
        { name: roomName },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );
  
      const roomId = response.data.id;
  
      // Save call details in your database
      // const call = new Call({
      //   roomId,
      //   participants: [
      //     { user: callerId, role: 'host' },
      //     { user: guestId, role: 'guest' },
      //   ],
      //   status: 'active',
      //   token,
      // });
  
      // await call.save();
  
      const fetchRoomCodes = async (retries = 3) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); 
  
            const roomCodeResponse = await axios.post(
              `https://api.100ms.live/v2/room-codes/room/${roomId}`,
              {}, 
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              }
            );
  
            if (roomCodeResponse.data.data) {
              return roomCodeResponse.data.data;
            }
          } catch (error) {
            console.error(`Attempt ${attempt} failed to fetch room codes:`, error.message);
            if (attempt === retries) {
              throw error;
            }
          }
        }
      };
  
      const roomCodes = await fetchRoomCodes();
  
      const guest = await User.findById(guestId);
  
      if (!guest || !guest.deviceToken) {
        return res.status(404).json({ error: 'Guest user not found or device token missing' });
      }
  
      const guestRoomCode = roomCodes.find(code => code.role === 'guest')?.code || '';
  
      const message = {
        token: guest.deviceToken,
        notification: {
          title: 'Incoming Call',
          body: `You have an incoming call from ${callerId}`,
        },
        data: {
          roomId: String(roomId),
          roomCode: String(guestRoomCode),
          callerId: String(callerId),
        },
        android: {
          priority: 'high',
          ttl: 60 * 60 * 24 * 1000,
        },
        apns: {
          headers: {
            'apns-priority': '10',
            'apns-expiration': `${Math.floor(Date.now() / 1000) + 86400}`,
          },
        },
      };
  
      await admin.messaging().send(message);

      const call = await Call.findOneAndUpdate(
        { roomId },
        {
          roomId,
          participants: [
            { user: callerId, role: 'host' },
            { user: guestId, role: 'guest' },
          ],
          status: 'active',
          roomCodes,
        },
        { upsert: true, new: true } // Create a new record if none exists
      );
  
      res.status(200).json({
        message: 'Call started successfully',
        roomId,
        roomCodes,
        token,
      });
    } catch (err) {
      console.error('Error starting call:', err);
      res.status(500).json({ error: 'Failed to start call' });
    }
  };  
  

 exports.getCallInfo = async (req, res) => {
  const { roomId } = req.params;

  try {
    // Find the call document by roomId
    const call = await Call.findOne({ roomId });

    if (!call) {
      return res.status(404).json({ message: 'Call not found or has ended' });
    }

    // Find the room code for the guest
    const guestRoomCode = call.roomCodes.find(code => code.role === 'guest')?.code;

    if (!guestRoomCode) {
      return res.status(404).json({ message: 'Guest room code not found' });
    }

    res.status(200).json({
      roomId,
      guestRoomCode,
      message: 'Call information retrieved successfully',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve call info' });
  }
};

  
  

  exports.endCall = async (req, res) => {
    const { roomId } = req.body;
  
    try {
      const call = await Call.findOne({ roomId });
  
      if (!call) {
        return res.status(404).json({ error: 'Call not found' });
      }

      call.status = 'ended';
      await call.save();
  
      res.status(200).json({ message: 'Call ended successfully' });
    } catch (err) {
      console.error('Error ending call:', err);
      res.status(500).json({ error: 'Failed to end call' , message: err});
    }
  };
  
  exports.declineCall = async (req, res) => {
    const { roomId } = req.body;
  
    try {
      // Find the call in your database
      const call = await Call.findOne({ roomId });
  
      if (!call) {
        return res.status(404).json({ error: 'Call not found' });
      }
  
      // Update the call status to declined
      call.status = 'declined';
      await call.save();
  
      // Find the caller's information
      const caller = await User.findById(call.participants.find(p => p.role === 'host').user);
  
      if (!caller || !caller.deviceToken) {
        return res.status(404).json({ error: 'Caller not found or device token missing' });
      }
  
      const message = {
        token: caller.deviceToken,
        notification: {
          title: 'Call Declined',
          body: 'The guest has declined your call.',
        },
        data: {
          roomId: String(roomId), 
        },
        android: {
          priority: 'high',
          ttl: 60 * 60 * 24 * 1000,
        },
        apns: {
          headers: {
            'apns-priority': '10',
            'apns-expiration': `${Math.floor(Date.now() / 1000) + 86400}`, // 1 day
          },
        },
      };
  
      await admin.messaging().send(message);
  
      // End the call by updating the status or any other necessary cleanup
      res.status(200).json({ message: 'Caller notified that the call has been declined' });
    } catch (err) {
      console.error('Error handling declined call:', err);
      res.status(500).json({ error: 'Failed to handle declined call' });
    }
  };
  