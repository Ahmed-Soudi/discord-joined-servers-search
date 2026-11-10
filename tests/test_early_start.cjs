/* Verifies page bridge does not assume <html> exists at document_start. */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname,'..','page-bridge.js'),'utf8');
const document = {
  documentElement: null,
  addEventListener(){},
  querySelectorAll(){return [];}
};
const calls=[];
class MutationObserver {
  constructor(handler){this.handler=handler;}
  observe(target){
    if(!target)throw new Error('Missing observer target at document_start');
    calls.push(target);
  }
}
const window = { addEventListener(){}, postMessage(){} };
const context={window,document,MutationObserver,setInterval(){},setTimeout(){},location:{origin:'https://discord.com'}};
vm.runInNewContext(src,context,{timeout:2000});
if(calls[0]!==document)throw new Error('Bridge did not observe the document');
console.log('PASS [document_start]: bridge initializes even when document.documentElement is null');
