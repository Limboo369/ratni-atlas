'use strict';
/* Battlefield miniatures. Presentation only: never write to units or use the simulation RNG.
   Geometry is painted once per model/era/team into a bounded sprite cache. Map and armory
   share the same artwork; no downloads, textures or additional GPU contexts are required. */
RA.unitSize = (cell) => RA.clamp(cell * 4.4, 25, 48);
RA.Models = (() => {
  const cache = new Map(), previews = new Map();
  const structures = new Set(['city','factory','barracks','market','fort','port','airport','silo','sam','dome','siege','hangar']);
  const ink = '#172127', steel = '#889a99', light = '#c4cec4', dark = '#414e4c';
  function paint(c, type, color, era) {
    const old = ['rim', 'srednji'].includes(era), horseAge = old || era === 'napoleon';
    c.lineJoin = 'round'; c.lineCap = 'round';
    const path = (points, fill, stroke = ink, width = 1) => {
      c.beginPath(); points.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath();
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
    };
    const line = (points, stroke, width = 1) => {
      c.beginPath(); points.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p));
      c.strokeStyle = stroke; c.lineWidth = width; c.stroke();
    };
    const rect = (x, y, w, h, fill, stroke = ink, r = 1) => {
      c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill();
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = 0.8; c.stroke(); }
    };
    const ellipse = (x, y, rx, ry, fill, stroke) => {
      c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 0.8; c.stroke(); }
    };
    const shadow = (x = 1, y = 9, rx = 18, ry = 7) => ellipse(x, y, rx, ry, 'rgba(5,12,17,.32)');
    const metal = c.createLinearGradient(-14, -16, 14, 15);
    metal.addColorStop(0, '#c0c5ab'); metal.addColorStop(.4, '#7c8a75'); metal.addColorStop(1, '#3b4c44');
    const flag = (x, y) => { line([[x,y],[x,y-13]], light, .9); path([[x,y-13],[x+8,y-11],[x+8,y-6],[x,y-8]], color, ink, .6); };
    const wheel = (x,y,r=3) => { ellipse(x,y,r,r,'#20282b', '#8a938c'); ellipse(x,y,r*.38,r*.38, '#8a938c'); };
    const soldier = (x, y, archer = false) => {
      c.save(); c.translate(x,y);
      ellipse(1,10,5,2,'rgba(5,12,17,.3)');
      line([[-2,3],[-3,9],[-4,10]], '#252f2e', 3);
      line([[2,3],[3,8],[4,9]], '#37433b', 3);
      rect(-4,-5,8,10, old ? '#aaa58b' : '#6a7960');
      rect(-2,-3,4,5,color,null,.4);
      line([[-4,-2],[-6,3],[-3,4]], '#8d9a79', 2.5);
      line([[4,-2],[6,2],[3,4]], '#8d9a79', 2.5);
      ellipse(0,-7,3,3,'#b9a58a',ink);
      ellipse(-.5,-9,4,2.7, horseAge ? '#aaa993' : '#66765c',ink);
      line([[-3,-10],[1,-11]], light,.7);
      if (old && !archer) {
        rect(-6,-1,5,8,era==='rim' ? '#853e36' : color,ink,era==='rim'?1:2);
        ellipse(-3.5,3,1,1,'#d6bb7a');
        line([[6,8],[6,-14]],'#b29b72',1.1); path([[6,-17],[4.7,-12],[7.3,-12]],light);
      } else if (archer) {
        c.beginPath(); c.arc(7,-1,6,-1.3,1.3); c.strokeStyle='#c1a577'; c.lineWidth=1.3; c.stroke();
        line([[8.6,-6.8],[8.6,4.8]],light,.55); line([[4,1],[14,-2]],'#dfd0aa',.8);
      } else {
        line([[-3,5],[7,-5]], '#172124', 2); line([[6,-4],[10,-9]], '#9aaba9',1.2);
        rect(2,-1,2,3,'#293530',null,0);
      }
      c.restore();
    };
    if (type === 'inf' || (type === 'art' && old)) {
      soldier(-9,-3,type==='art'); soldier(9,0,type==='art'); soldier(0,8,type==='art');
    } else if (type === 'cav') {
      shadow(0,12,19,5);
      line([[-10,4],[-12,13],[-8,13]],dark,2.6); line([[9,4],[12,12],[15,12]],dark,2.6);
      path([[-17,2],[-13,-6],[-2,-7],[7,-5],[9,-14],[14,-17],[18,-13],[17,-8],[12,-7],[12,4],[5,8],[-8,7]], '#8b7962');
      line([[-13,-4],[-18,1],[-20,6]], '#302f2a',2);
      path([[-8,-6],[4,-5],[5,4],[-7,3]],color); line([[13,-16],[11,-12],[10,-8]],light,1);
      line([[-2,-7],[2,3],[6,4]],'#2e393c',3);
      rect(-5,-17,8,11,era==='srednji'?'#aeb6b4':'#777f71');
      ellipse(-1,-21,3.6,4,'#aeb6b4',ink); line([[-3,-21],[1,-21]],ink,1);
      line([[3,-14],[9,-12]],light,2); line([[8,5],[12,-28]],'#bfa57c',1);
      path([[12,-28],[19,-24],[12,-23]],color);
    } else if (type === 'tank') {
      shadow(0,5,21,13);
      for (const y of [-14,8]) {
        rect(-18,y,34,7,'#263032', '#111b20',2);
        for(let x=-15;x<16;x+=4) line([[x,y+1],[x,y+6]],'#677270',1);
      }
      path([[-18,-8],[-13,-12],[12,-12],[18,-7],[18,7],[12,12],[-13,12],[-18,8]],metal);
      path([[-15,-7],[-10,-9],[11,-9],[15,-5],[15,6],[10,9],[-12,9]],'#84907a');
      rect(-15,-6,8,12,'#45554d');
      for(let y=-4;y<6;y+=2) line([[-13,y],[-8,y]],'#a4ad99',.7);
      rect(-4,-10,5,20,color,null,.4);
      if(era==='ww1') {
        path([[-8,-8],[9,-8],[14,-4],[14,5],[8,9],[-8,9]], metal);
        rect(5,7,4,8,'#7e8b77'); rect(7,12,3,8,'#a5b0a2');
        line([[-6,-5],[9,-5]],light,.7);
      } else {
        ellipse(1,1,9,8,'#263a34');
        path([[-6,-7],[4,-8],[11,-4],[11,5],[4,8],[-6,6],[-9,0]],metal);
        rect(7,-2,20,3.7,'#909e89',ink,.6); rect(24,-3,5,5,'#53665b');
        ellipse(-1,-1,3.4,3.4,'#45564c', '#afbaab'); line([[-3,-2],[0,-3]],light,.8);
        line([[-7,4],[-12,17]], '#212e2c',.6);
      }
      line([[-12,-11],[10,-11]],'#d0d2b9',.8);
      rect(12,-8,3,2,'#e9d9a6',null,.5); rect(12,7,3,2,'#e9d9a6',null,.5);
    } else if (type === 'art') {
      shadow(0,8,18,7);
      line([[-5,2],[-19,13]],dark,3); line([[-5,-2],[-19,-13]],dark,3);
      wheel(-2,-10,5); wheel(-2,10,5);
      path([[-8,-6],[2,-9],[8,-5],[8,5],[2,9],[-8,6]],metal);
      rect(-6,-3,12,6,dark); rect(0,-2,25,4,'#9caa99'); rect(23,-3,5,6,'#52665b');
      rect(-6,-7,4,14,color,null); ellipse(-3,0,2,2,light);
    } else if (type === 'boat' || type === 'trade') {
      // Bow points right, like the simulation's route tangent.
      shadow(2,3,24,8);
      path([[-22,-8],[9,-8],[25,0],[9,8],[-22,8]],'#1d303b', '#a8bbc1');
      path([[-19,-6],[9,-6],[21,0],[9,6],[-19,6]],'#889795');
      if (horseAge) {
        path([[-15,-5],[12,-5],[18,0],[12,5],[-15,5]],'#987d54');
        line([[-2,-13],[-2,12]],'#d2c3a0',1.4);
        path([[-1,-13],[11,-7],[11,8],[-1,12]],'#d7d3ba'); line([[1,-6],[9,-3]],color,2);
      } else {
        rect(-17,-5,8,10,'#c7cec6'); rect(-15,-3,3,6,'#405a66');
        if(type==='trade') for(let x=-5;x<13;x+=6) { rect(x,-5,5,4,color);rect(x,1,5,4,'#ab9d7d'); }
        else { rect(-5,-4,14,8,color); rect(2,-2,8,4,'#748778'); ellipse(13,0,2,2,light); }
        line([[-12,0],[-12,-10]],light,.8);
      }
    } else if (type === 'ship' || type === 'sub') {
      // navy (placeholder art until Codex draws per-era ships): bow points right like the route tangent
      shadow(2,3,26,8);
      if (type === 'sub' && !horseAge && era !== 'napoleon') {
        path([[-24,-4],[14,-5],[26,0],[14,5],[-24,4]],'#233540','#6f8790');
        rect(-4,-9,9,5,'#2c3f49');rect(-2,-12,3,3,color);line([[-22,0],[18,0]],'#8aa1a8',.6);
      } else if (horseAge || era === 'napoleon') {
        path([[-24,-7],[12,-7],[26,0],[12,7],[-24,7]],'#5a4632','#b89a6a');
        for (const x of [-12,2]) { line([[x,-14],[x,12]],'#d2c3a0',1.3); path([[x+1,-13],[x+10,-8],[x+10,8],[x+1,11]],'#e0d7bd'); }
        rect(-20,-3,6,6,color);
      } else {
        path([[-24,-7],[12,-7],[27,0],[12,7],[-24,7]],'#2a3c46','#9fb2b6');
        path([[-20,-5],[10,-5],[22,0],[10,5],[-20,5]],'#7e8f8e');
        rect(-8,-4,10,8,'#b8c2bc');rect(-5,-2,5,4,color);
        for (const x of [-17,8]) { ellipse(x,0,3,3,'#5d6f6c');line([[x,0],[x+9,0]],'#3c4c4b',1.4); }
      }
    } else if (type === 'missile') {
      path([[-20,-3],[12,-3],[24,0],[12,3],[-20,3]],'#c5d0c5');
      path([[-15,-3],[-22,-9],[-22,-3]],color);path([[-15,3],[-22,9],[-22,3]],color);
      rect(4,-3,4,6,color,null,0);line([[-16,-1],[12,-1]],'#edf0db',.6);
    } else if (type === 'zeppelin') {
      ellipse(0,0,26,9,'#9daaa7',ink);ellipse(1,-2,24,5,'#c8cdbd');
      line([[-21,3],[19,3]],'#677b7c',.7);rect(-8,7,14,4,'#657675');
      path([[-17,-5],[-25,-13],[-24,-3]],color);path([[-17,5],[-25,13],[-24,3]],color);
    } else if (type === 'plane') {
      path([[25,0],[16,-3],[4,-3],[-5,-21],[-11,-21],[-6,-3],[-18,-2],[-23,-9],[-27,-9],[-24,0],[-27,9],[-23,9],[-18,2],[-6,3],[-11,21],[-5,21],[4,3],[16,3]], '#aab9b5');
      path([[25,0],[10,-1],[-21,-1],[-24,0],[-21,2],[10,2]],'#d4dbce',null);
      path([[15,-2],[19,0],[15,2],[11,2],[11,-2]],'#344e59');
      rect(-9,-17,5,5,color,null);rect(-9,12,5,5,color,null);
      for(const y of [-9,7]) rect(-1,y,9,3,'#596d70');
    } else if(type==='train' || type==='cart') {
      shadow(0,4,24,5);
      for(const x of [-19,-13,1,8,15]) wheel(x,5,2.5);
      rect(-23,-5,17,10,horseAge?'#9c8968':'#70827b');rect(-4,-5,24,10,metal);
      rect(-21,-4,13,3,color,null);rect(-2,-4,17,3,color,null);
      if(horseAge) { line([[20,0],[27,0]],'#c7b68b',2); }
      else { rect(13,-4,5,8,'#263a40');rect(2,-3,5,6,'#c5c8b6'); }
    } else {
      // Flat front elevations: shared baseline, no perspective or cast shadows.
      // The same cached artwork is used on the map and in the construction menu.
      c.translate(0, 4);
      const wall = '#bbc5b7', roof = '#637d78', pane = '#263e48', trim = '#e3dcc2';
      const windows = (xs, ys) => { for (const x of xs) for (const y of ys) rect(x,y,3,4,pane,null,0); };
      const door = (x,y=-1,w=6,h=13) => rect(x,y,w,h,pane,null,0);
      const stripe = (x,y,w) => rect(x,y,w,3,color,ink,0);
      const base = () => line([[-23,13],[23,13]],ink,1.8);
      const roofline = (x,y,w,h=7) => path([[x-2,y],[x+w/2,y-h],[x+w+2,y]],roof,ink,1.2);
      const pennant = (x,y) => {line([[x,y],[x,y-12]],ink,1.2);path([[x,y-12],[x+7,y-12],[x+7,y-7],[x,y-7]],color,ink,.8);};
      if(type==='city') {
        if(horseAge) {
          rect(-21,-4,13,17,wall);roofline(-21,-4,13);
          rect(8,-4,13,17,wall);roofline(8,-4,13);
          rect(-7,-18,14,31,wall);roofline(-7,-18,14,6);
          windows([-17,13],[1]);windows([-2],[-13,-6]);door(-3,3,6,10);stripe(-7,-2,14);
        } else {
          rect(-21,-8,13,21,wall);rect(8,-3,13,16,wall);rect(-8,-24,16,37,wall);
          stripe(-8,-21,16);windows([-18,12],[2]);windows([-4,2],[-14,-6,2]);
          line([[-10,-24],[10,-24]],trim,1.2);
        }
        base();
      } else if(type==='factory') {
        rect(11,-24,7,29,wall);stripe(11,-20,7);
        path([[-22,13],[-22,-4],[-11,-12],[-11,-4],[0,-12],[0,-4],[10,-12],[10,-4],[22,-4],[22,13]],wall,ink,1.2);
        line([[-22,-4],[-11,-12],[-11,-4],[0,-12],[0,-4],[10,-12],[10,-4],[22,-4]],roof,2);
        windows([-17,-8,1],[2]);door(12,1,6,12);base();
      } else if(type==='barracks') {
        rect(-21,-5,42,18,wall);roofline(-21,-5,42,11);
        stripe(-21,-5,42);windows([-16,-9,6,13],[2]);door(-3,2,6,11);
        pennant(0,-16);base();
      } else if(type==='market') {
        rect(-20,-3,40,16,wall);path([[-23,-3],[-18,-15],[18,-15],[23,-3]],roof,ink,1.2);
        for(let x=-18;x<18;x+=12) path([[x,-15],[x+6,-15],[x+7,-3],[x-1,-3]],trim,null);
        stripe(-21,-3,42);door(-4,3,8,10);windows([-16,12],[3]);base();
      } else if(type==='fort') {
        if(horseAge) {
          rect(-14,-2,28,15,wall);
          for(const x of [-22,12]) {
            path([[x,13],[x,-19],[x+3,-19],[x+3,-15],[x+7,-15],[x+7,-19],[x+10,-19],[x+10,13]],wall,ink,1.2);
            windows([x+3],[-9]);
          }
          door(-4,3,8,10);stripe(-12,-2,24);pennant(0,-3);
        } else {
          path([[-23,13],[-20,-3],[-12,-12],[12,-12],[20,-3],[23,13]],wall,ink,1.2);
          rect(-15,-1,30,5,pane,null,0);stripe(-9,-9,18);line([[-20,8],[20,8]],roof,1.2);
        }
        base();
      } else if(type==='port') {
        rect(-22,-3,19,14,wall);roofline(-22,-3,19);door(-17,2,9,9);
        line([[8,11],[8,-24],[22,-24]],roof,2.5);line([[8,-24],[-2,-15],[22,-15]],roof,1.5);
        line([[20,-23],[20,-4]],pane,1);line([[17,-4],[17,0],[20,2],[23,0]],trim,1.5);
        stripe(-22,-3,19);base();line([[-22,18],[-11,18],[-7,16],[0,18],[7,18],[11,16],[22,18]],'#8aafbb',1.4);
      } else if(type==='airport') {
        rect(-23,5,32,8,wall);rect(-18,-3,5,8,roof);rect(-21,-10,11,7,pane,ink);
        stripe(-21,-10,11);rect(9,-21,12,34,pane);line([[15,-18],[15,-12]],trim,1.4);
        line([[15,-6],[15,0]],trim,1.4);line([[15,6],[15,10]],trim,1.4);windows([-19,-11,-3],[7]);base();
      } else if(type==='silo') {
        rect(-22,4,44,9,roof);
        for(const x of [-15,6]) {
          path([[x,4],[x,-15],[x+5,-23],[x+10,-15],[x+10,4]],wall,ink,1.2);
          stripe(x,-10,10);path([[x,-1],[x-4,6],[x,6]],roof);path([[x+10,-1],[x+14,6],[x+10,6]],roof);
        }
        base();
      } else if(type==='sam') {
        rect(-22,5,44,8,roof);rect(-13,0,22,5,wall);
        for(const x of [-9,1,11]) {
          path([[x,0],[x+5,-18],[x+8,-23],[x+10,-17],[x+5,1]],wall,ink,1.2);
          line([[x+5,-12],[x+8,-11]],color,2.6);
        }
        line([[-19,4],[-19,-17]],roof,2);ellipse(-19,-18,4,4,wall,ink);base();
      } else if(type==='dome') {
        c.beginPath();c.arc(0,3,20,Math.PI,0);c.closePath();c.fillStyle=wall;c.fill();c.strokeStyle=ink;c.lineWidth=1.2;c.stroke();
        c.beginPath();c.ellipse(0,3,9,20,0,Math.PI,0);c.strokeStyle=roof;c.stroke();
        line([[-17,-7],[17,-7]],roof,1);rect(-22,3,44,10,roof);stripe(-22,3,44);door(-4,6,8,7);base();
      } else if(type==='siege') {
        for(const x of [-15,15]) wheel(x,10,4);
        line([[-20,6],[20,6]],roof,4);line([[-11,6],[0,-13],[11,6]],wall,3);
        line([[-10,1],[12,-22]],trim,3);rect(9,-24,8,7,roof);stripe(-11,3,22);
        line([[-10,1],[-10,-7]],pane,1);ellipse(-10,-9,4,3,wall,ink);
      } else if(type==='hangar') {
        c.beginPath();c.moveTo(-23,13);c.lineTo(-23,-1);c.arc(0,-1,23,Math.PI,0);c.lineTo(23,13);c.closePath();
        c.fillStyle=wall;c.fill();c.strokeStyle=ink;c.lineWidth=1.2;c.stroke();
        rect(-17,-3,34,16,pane);stripe(-17,-3,34);line([[0,1],[0,12]],roof,1);base();
      }

    }
  }
  function sprite(type, color) {
    const era = RA.ERA ? RA.ERA.id : 'modern', key = `${era}:${type}:${color}`;
    if(cache.has(key)) return cache.get(key);
    // 128 px stays sharp at maximum map zoom and in the larger unit previews.
    const canvas = document.createElement('canvas');canvas.width=canvas.height=128;
    const c=canvas.getContext('2d'); c.translate(64,64);c.scale(2,2);paint(c,type,color,era);
    if(cache.size>=256) cache.delete(cache.keys().next().value);
    cache.set(key,canvas);return canvas;
  }
  function draw(ctx,type,x,y,size,color,angle=0) {
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(sprite(type,color),-size*.7,-size*.7,size*1.4,size*1.4);ctx.restore();
  }
  function preview(type,color) {
    const key=`${RA.ERA && RA.ERA.id}:${type}:${color}`;
    if(!previews.has(key)) { if(previews.size>=64) previews.clear(); previews.set(key,sprite(type,color).toDataURL()); }
    return `<span class="model-preview${structures.has(type) ? ' flat-model' : ''}" aria-hidden="true"><img alt="" src="${previews.get(key)}" width="96" height="96"></span>`;
  }
  return {draw,preview};
})();

RA.drawStructIcon = (ctx,type,x,y,size,color) => RA.Models.draw(ctx,type,x,y,size*1.45,color);
RA.drawUnit = function(ctx,type,x,y,size,color,mine,hp,deploying,emp,selected,now,angle=0,moving=false,hit=false) {
  ctx.save();
  if(deploying) ctx.globalAlpha=.55;
  // A ground ring identifies the owner without turning the model into a counter.
  ctx.beginPath();ctx.ellipse(x,y+size*.32,size*.48,size*.20,0,0,Math.PI*2);
  ctx.strokeStyle=selected?'#eed59c':color;ctx.lineWidth=selected?2.5:1.5;ctx.stroke();
  if(selected) {ctx.strokeStyle='rgba(238,213,156,.4)';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,y+size*.32,size*.58,size*.26,0,0,Math.PI*2);ctx.stroke();}
  if(moving && !deploying && !emp) {
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    for(let i=0;i<3;i++) {const p=(now/550+i/3)%1;ctx.globalAlpha=.22*(1-p);ctx.fillStyle='#b7aa89';ctx.beginPath();ctx.ellipse(-size*(.35+p*.35),size*.16,size*(.06+p*.07),size*.05,0,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
  // Keep soldiers upright; vehicles turn towards their actual next waypoint.
  const vehicle=type==='tank'||type==='ship'||type==='sub'||(type==='art'&&!['rim','srednji'].includes(RA.ERA && RA.ERA.id));
  RA.Models.draw(ctx,type,x,y,size,color,vehicle?angle:0);
  const bw=size*.68, by=y+size*.6;
  ctx.fillStyle='#15232be6';ctx.fillRect(x-bw/2-1,by-1,bw+2,5);
  ctx.fillStyle=hp>.6?'#91bd9e':hp>.3?'#d9b974':'#ea7867';ctx.fillRect(x-bw/2,by,bw*RA.clamp(hp,0,1),3);
  if(mine) {ctx.fillStyle='#f4e6c6';ctx.fillRect(x-bw/2-5,by,2,3);}
  if(hit) {ctx.strokeStyle='#ef9e70';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,size*.52,-.5,.5);ctx.stroke();}
  ctx.restore();if(emp) RA.drawZap(ctx,x,y,size*.8,now);
};
RA.drawPlane = function(ctx,x,y,angle,color) {
  ctx.save();ctx.globalAlpha=.16;RA.Models.draw(ctx,'plane',x+9,y+15,34,'#15232b',angle);ctx.restore();
  RA.Models.draw(ctx,'plane',x,y,34,color,angle);
};
RA.drawShip = function(ctx,type,x,y,size,color,angle,now) {
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  for(let i=0;i<3;i++) {const p=(now/1200+i/3)%1;ctx.beginPath();ctx.moveTo(-size*(.35+p*.7),-size*(.12+p*.22));ctx.lineTo(-size*.3,0);ctx.lineTo(-size*(.35+p*.7),size*(.12+p*.22));ctx.strokeStyle=`rgba(192,223,229,${.35*(1-p)})`;ctx.lineWidth=1;ctx.stroke();}
  ctx.restore();RA.Models.draw(ctx,type,x,y,size,color,angle);
};
RA.drawImpact = function(ctx,x,y,r,age) {
  const k=RA.clamp(age/.95,0,1);if(k>=1)return;
  ctx.save();
  for(let i=0;i<7;i++) {const a=i*2.399, d=r*(.2+k*.75);ctx.beginPath();ctx.ellipse(x+Math.cos(a)*d,y+Math.sin(a)*d-k*r*.3,r*(.1+k*.22),r*(.1+k*.18),0,0,Math.PI*2);ctx.fillStyle=`rgba(47,48,43,${.4*(1-k)})`;ctx.fill();}
  if(k<.5) {const glow=ctx.createRadialGradient(x,y,0,x,y,r*(.2+k));glow.addColorStop(0,'#fff5cd');glow.addColorStop(.3,'#ffc270');glow.addColorStop(1,'rgba(234,95,40,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,r*(.2+k),0,Math.PI*2);ctx.fill();}
  ctx.strokeStyle=`rgba(240,181,104,${.85*(1-k)})`;ctx.lineWidth=1.3;
  for(let i=0;i<9;i++) {const a=i*2.399;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*r*k,y+Math.sin(a)*r*k);ctx.lineTo(x+Math.cos(a)*r*(k+.12),y+Math.sin(a)*r*(k+.12));ctx.stroke();}
  ctx.restore();
};
