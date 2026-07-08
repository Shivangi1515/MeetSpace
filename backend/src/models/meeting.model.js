import mongoose,{Schema} from "mongoose";
const meetingSchema=new Schema({

    user_id:{type:String},
    meetingCode:{type:String,required:true},
    date:{type:Date,default:Date.now,required:true}, 
    duration:{type:Number, default: 0}, // duration in seconds
    participantsCount:{type:Number, default: 1},
    chatCount:{type:Number, default: 0},
    meetingTitle:{type:String, default: "MeetSpace Session"}

})

const Meeting=mongoose.model("Meeting",meetingSchema);

export {Meeting};