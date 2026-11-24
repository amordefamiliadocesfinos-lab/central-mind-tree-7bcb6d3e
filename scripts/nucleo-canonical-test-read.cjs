// Structural assertions use the canonical Git text, independently of Windows checkout EOL.
// Binary reads (hashes, sovereign bytes, attachments) are never transformed.
const fs=require('node:fs');
const original=fs.readFileSync;
fs.readFileSync=function(...args){
 const result=original.apply(this,args);
 return typeof result==='string'&&/\.(?:tsx?|[cm]js|sql|ya?ml)$/.test(String(args[0]))
  ?result.replace(/\r\n/g,'\n'):result;
};
