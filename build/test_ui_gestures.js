'use strict';
// Event-level regressions for sheet dismissal and League connection recovery.
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const context = {RA:{t:s=>s}, Date, console};
vm.createContext(context);
for (const f of ['08-ui.js', '09f-league.js']) vm.runInContext(fs.readFileSync('src/'+f,'utf8'), context);
function sheet() {
  const events = {}, classes = new Set();
  const s = {dataset:{}, style:{}, scrollTop:0, scrollHeight:900, clientHeight:500,
    addEventListener(k,fn){(events[k] ||= []).push(fn);},
    classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)},
    contains(el){return el===s||el.parentElement===s;},
    fire(k,e={}){for(const f of events[k]||[])f(e);}
  };
  const body={parentElement:s,closest:()=>null,scrollHeight:100,clientHeight:100,scrollTop:0};
  const ui={closed:false,closeSheet(){this.closed=true;this.sheetDrag=null;}};
  context.RA.UI.prototype.bindSheetDrag.call(ui,s);
  const start=(target=body)=>s.fire('touchstart',{target,touches:[{clientX:100,clientY:100}]});
  const move=(x,y)=>{let prevented=false;s.fire('touchmove',{touches:[{clientX:x,clientY:y}],cancelable:true,preventDefault(){prevented=true;}});return prevented;};
  return {ui,s,body,start,move,end:()=>s.fire('touchend')};
}
let f=sheet();f.start();assert(f.move(105,200));f.end();assert(f.ui.closed,'body swipe dismisses');
f=sheet();f.start();assert(f.move(100,130));f.end();assert(!f.ui.closed,'short swipe returns');assert.equal(f.s.style.translate,'');
f=sheet();f.s.scrollTop=20;f.start();assert(!f.move(100,200));f.end();assert(!f.ui.closed,'scrolled body stays open');
f=sheet();f.body.scrollHeight=300;f.body.scrollTop=30;f.start();assert(!f.move(100,200));f.end();assert(!f.ui.closed,'nested list keeps scrolling');
f=sheet();f.start();assert(!f.move(100,40));f.end();assert(!f.ui.closed,'upward gesture scrolls');
f=sheet();f.start();assert(!f.move(210,150));f.end();assert(!f.ui.closed,'horizontal gesture does not dismiss');
f=sheet();f.start({closest:()=>true});assert(!f.ui.sheetDrag,'form controls retain touch');
f=sheet();f.start();f.move(100,210);f.s.fire('touchcancel');assert(!f.ui.closed,'cancelled gesture resets');
f=sheet();f.start();f.move(100,210);f.end();let suppressed=false;f.s.fire('click',{preventDefault(){suppressed=true;},stopImmediatePropagation(){}});assert(suppressed,'drag does not activate a button');
let refreshes=0, sockets=[];
context.WebSocket=class {constructor(){this.readyState=0;sockets.push(this);}send(){}};
context.dispatchEvent=()=>assert.fail('League rejection must not dismiss the launcher');
const league=new context.RA.League({net:{wsUrl:'ws://test'},long:{name:()=>'',uid:()=>''},ui:{leagueRefresh(){refreshes++;}}});
league.connect();const first=league.ws;first.onclose({code:4401});assert.equal(league.connection,'auth');assert.equal(league.ws,null);assert.equal(sockets.length,1,'no reconnect loop');assert.equal(refreshes,1);
league.connect();league.onMsg({t:'hi',elo:{},me:'p1'});assert.equal(league.connection,'ready');
first.onclose({code:4401});assert.equal(league.connection,'ready','stale socket cannot replace new state');
console.log('PASS: sheet body gestures, nested scrolling, cancellation, click suppression and League auth recovery');
