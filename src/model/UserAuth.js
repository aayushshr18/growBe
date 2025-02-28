const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  fullName: { type: String },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  firstLogin:{
    type:Boolean,
    default:true
  },
  password:{
    type:String,
  },
  otp:{
    type:String,
  },
  otpExpiry:{
    type:Date
  },
  mobile: { type: String},
  profileType:{
    type:String,
  },
  createdDate: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
