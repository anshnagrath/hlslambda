const fluent = require('fluent-ffmpeg');
fluent.setFfmpegPath('/opt/bin/ffmpeg');
const fs = require('fs');
const { S3 } = require('aws-sdk');
//  region: process.env.AWS_REGION , secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ,accessKeyId: process.env.AWS_ACCESS_KEY_ID 
const s3 = new S3();
const Path = require('path');



const  readFile =  (bucketName, filename) => {
    return new Promise((resolve,reject)=>{
          var params = { Bucket: bucketName, Key: filename };
         s3.getObject(params, function (err, data) {
             if (!err) 
                 resolve(data.Body);
             else
                 resolve(err);
         });
    })
        
  }
  
 const deleteFolderRecursive = function(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach((file, index) => {
      const curPath = Path.join(path, file);
      if (fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};

const executeFfmpeg = (args) => {
    let command = fluent().output(' ');
    command._outputs[0].isFile = false; // disable adding "-y" argument
    command._outputs[0].target = ""; 
    command._global.get = () => { // append custom arguments
        return typeof args === "string" ? args.split(' ') : args;
    };

    return command;
};

const convertFile = ( keyName , fileName , resolution )=>{
    return new Promise((resolve,reject)=>{  
        // 640x360
    console.log(`/tmp/out/${keyName.replace(/ /g,'')}/${resolution}/${fileName}`,"asdcsdcsadcasdc======>>>");
     console.log( fs.readdirSync(`/tmp/out/${keyName.replace(/ /g,'')}/${resolution}`) );
      console.log( fs.readdirSync(`/tmp/files/`) );
      
    //  executeFfmpeg(`-y -i /tmp/files/${keyName} -vcodec copy -acodec copy -movflags faststart /tmp/out/${keyName}/${resolution}/${fileName}`)
     
     executeFfmpeg(`-y -i /tmp/files/${keyName} -profile:v baseline -level 3.0 -s ${resolution} -start_number 0 -hls_time 6 -hls_list_size 0 -f hls /tmp/out/${keyName.replace(/ /g,'')}/${resolution}/${fileName}`)
    .on('start', commandLine => console.log('start', commandLine))
    .on('codecData', codecData => console.log('codecData', codecData))
    .on('error', function(err, stdout, stderr) {
                console.log('An error occurred: ' + err.message, err, stderr);
                reject(err)
    })
    .on('end',resolve)
    .run();

    })
}

const uploadFile = async( BucketName , FilePath , base64Data , Acltype   ) =>{
    return new Promise ((resolve,reject)=>{
        const params = {
            
        Bucket: BucketName,
        Key: FilePath,
        Body: base64Data,
        // ACL: Acltype,
        ContentType: 'application/octet-stream'
      }
      console.log(params,"asdcscdscsdc=========");
      
     s3.putObject(params, (err,success)=>{
            console.log(err,success,"======>");
            resolve()
         
     } )
        
        
    })

}
exports.handler = async (event, context, callback) => {
       
    //   const bucketName = process.env.bucketName;
      const bucketName = 'juneappbucket';
       
       const keys = event.Records[0].s3.object.key.split('/')
       const keyName = keys[keys.length -1].replace(/ /g,'');
       
       const file = await readFile(bucketName,keyName);
       
         if (!fs.existsSync('/tmp/files/'))  fs.mkdirSync('/tmp/files/');
       
         if (!fs.existsSync(`/tmp/out/${keyName.replace(/ /g,'')}/360x640`))  fs.mkdirSync(`/tmp/out/${keyName.replace(/ /g,'')}/360x640`,{ recursive : true});
       
         if (!fs.existsSync(`/tmp/out/${keyName.replace(/ /g,'')}/670x1200`)) fs.mkdirSync(`/tmp/out/${keyName.replace(/ /g,'')}/670x1200`,{ recursive : true});
            
       const writeFile = fs.writeFileSync(`/tmp/files/${keyName}`,file);

       const fileName = new Date().getTime().toString() + keyName.split('.')[0] + '.m3u8';
       
   
       await convertFile( keyName , fileName , '360x640' ).catch(console.log)

       await convertFile( keyName , fileName , '670x1200' ).catch(console.log)
    
       let  lowerResolution  =  fs.readdirSync(`/tmp/out/${keyName.replace(/ /g,'')}/360x640/`);
       
        console.log("asdcsacscsdc loverererv",lowerResolution)
        
        
       let  higherResolution  =  fs.readdirSync(`/tmp/out/${keyName.replace(/ /g,'')}/670x1200/`);
    
        let  allUploads = [ ];
        
      for( let file of  lowerResolution ) { 
        console.log(file,"asdcacdasdcsc-=sc=s-=-=s==s==")
        const  base64Data = fs.readFileSync(`/tmp/out/${keyName.replace(/ /g,'')}/360x640/${file}`)  
   
        allUploads.push(  uploadFile ( bucketName , `/converted/${fileName}/${file}` , base64Data , 'public' ) );
       
    }
 
    await Promise.all(allUploads)
    
    // http request
    

    // for(let file of  higherResolution) { 

    //     const  base64Data = fs.readFileSync(`/tmp/out/${keyName}/670x1200/${file}`)  

    //     await  uploadFile ( bucketName , `/public/converted/${fileName}/${file}` , base64Data , 'public' ).catch(console.log) ;
       
    // }

    // http request
    deleteFolderRecursive(`/tmp/out/${keyName.replace(/ /g,'')}`);

    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!'),
    };
    
    return response;

    
};




