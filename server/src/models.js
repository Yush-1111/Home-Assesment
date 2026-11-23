import mongoose,{Schema,Types} from 'mongoose';

const ContractSchema=new Schema({userId:{type:String,required:true,index:true},name:{type:String,required:true},mimeType:{type:String,required:true},size:{type:Number,required:true},status:{type:String,enum:['processing','reviewed','failed'],default:'processing'},createdAt:{type:Date,default:Date.now}}, {timestamps:false});
const ChunkSchema=new Schema({contractId:{type:Schema.Types.ObjectId,ref:'Contract',required:true,index:true},text:{type:String,required:true},locator:{type:String,required:true},ordinal:{type:Number,required:true},embedding:{type:[Number],default:undefined}}, {versionKey:false});
const FindingSchema=new Schema({contractId:{type:Schema.Types.ObjectId,ref:'Contract',required:true,index:true},item:{type:String,required:true},status:{type:String,enum:['found','not found','unclear'],required:true},summary:{type:String,required:true},quote:{type:String,default:''},locator:{type:String,default:''},fullClause:{type:String,default:''},createdAt:{type:Date,default:Date.now}}, {versionKey:false});
FindingSchema.index({contractId:1,item:1},{unique:true});
const MessageSchema=new Schema({contractId:{type:Schema.Types.ObjectId,ref:'Contract',required:true,index:true},role:{type:String,enum:['user','assistant'],required:true},content:{type:String,required:true},quote:{type:String,default:''},locator:{type:String,default:''},createdAt:{type:Date,default:Date.now}}, {versionKey:false});
export const Contract=mongoose.models.Contract||mongoose.model('Contract',ContractSchema);
export const Chunk=mongoose.models.Chunk||mongoose.model('Chunk',ChunkSchema);
export const Finding=mongoose.models.Finding||mongoose.model('Finding',FindingSchema);
export const Message=mongoose.models.Message||mongoose.model('Message',MessageSchema);
export const objectId=(id)=>Types.ObjectId.isValid(id);
