const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  role: {
    type: String,
    enum: ['host', 'guest'],
    required: true,
  },
});

const roomCodeSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  code: {
    type: String,
    required: true,
  },
  room_id: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['host', 'guest'],
    required: true,
  },
  enabled: {
    type: Boolean,
    default: true,
  },
  created_at: {
    type: Date,
    required: true,
  },
  updated_at: {
    type: Date,
    required: true,
  },
});

const callSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
  },
  participants: [participantSchema],
  status: {
    type: String,
    enum: ['active', 'declined', 'ended'],
    default: 'active',
  },
  roomCodes: [roomCodeSchema],
});

const Call = mongoose.model('Call', callSchema);

module.exports = Call;