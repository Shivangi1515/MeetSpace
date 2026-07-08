import mongoose,{Schema} from "mongoose";
const userSchema=new Schema({

    name:{type:String,required:true},
    username:{type:String,required:true,unique:true},
    password:{type:String,required:true},
    token:{type:String},
    email:{type:String, unique:true, sparse:true},
    isEmailVerified:{type:Boolean, default:false},
    verificationToken:{type:String},
    resetPasswordToken:{type:String},
    resetPasswordExpires:{type:Date}

})

const User=mongoose.model("User",userSchema);

export {User};