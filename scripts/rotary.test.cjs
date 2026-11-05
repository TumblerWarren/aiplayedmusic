const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, nodes, palette } = require('./ui-harness.cjs');

test('rotary geometry crosses the angle seam smoothly and clamps/quantizes supported ranges', async () => {
  const { rotationDelta, steppedKnob } = await import('../src/rotaryGeometry.js');
  assert(Math.abs(rotationDelta(-Math.PI+0.1,Math.PI-0.1)-0.2)<1e-9);
  assert(Math.abs(rotationDelta(Math.PI-0.1,-Math.PI+0.1)+0.2)<1e-9);
  for (const [min,max,step] of [[-12,12,.5],[-24,0,.5],[100,300,5],[.5,2,.05]]) {
    for(let i=-100;i<=100;i++) {
      const v=steppedKnob(i/30*(max-min),min,max,step);
      assert(v>=min&&v<=max);
      assert(Math.abs((v-min)/step-Math.round((v-min)/step))<1e-6);
    }
  }
});

test('clockwise/counterclockwise rotation previews and commits once; cancellation and multitouch discard', async () => {
  const geometry=await import('../src/rotaryGeometry.js'); const events=[]; let ui;
  const Pan=()=>{const g={};for(const name of ['enabled','minDistance','maxPointers','onTouchesDown','onBegin','onStart','onTouchesMove','onUpdate','onFinalize'])g[name]=v=>{g[name+'Value']=v;return g;};return g;};
  ui=harness('src/RotaryKnob.js',['RotaryKnob'],{...geometry, Svg:'Svg',Circle:'Circle',Path:'Path',Animated:{View:'AnimatedView'},Gesture:{Pan},GestureDetector:'GestureDetector',
    useSharedValue:v=>ui.context.useRef({value:v}).current,useAnimatedStyle:fn=>fn(),runOnJS:fn=>fn});
  const props={value:0,minimumValue:-12,maximumValue:12,step:.5,c:palette(false),accessibilityLabel:'Bass',accessibilityValue:{now:0,text:'0.0 dB'},onSlidingStart:v=>events.push(['start',v]),onValueChange:v=>events.push(['preview',v]),onSlidingComplete:v=>events.push(['commit',v]),onCancel:()=>events.push(['cancel'])};
  let tree=ui.render('RotaryKnob',props);ui.effects();
  const g=nodes(tree).find(n=>n.type==='GestureDetector').props.gesture;
  g.onBeginValue({x:64,y:14});g.onStartValue();g.onUpdateValue({x:114,y:64});g.onFinalizeValue({},true);
  assert.deepEqual(events,[['start',0],['preview',8],['commit',8]]);
  events.length=0;g.onBeginValue({x:64,y:14});g.onStartValue();g.onUpdateValue({x:14,y:64});g.onFinalizeValue({},true);
  assert.deepEqual(events,[['start',8],['preview',0],['commit',0]]);
  events.length=0;g.onBeginValue({x:64,y:14});g.onStartValue();g.onUpdateValue({x:114,y:64});g.onFinalizeValue({},false);
  assert.deepEqual(events,[['start',0],['preview',8],['cancel']]);
  events.length=0;g.onBeginValue({x:64,y:14});g.onStartValue();let failed=0;g.onTouchesMoveValue({numberOfTouches:2},{fail(){failed++;}});g.onUpdateValue({x:114,y:64});g.onFinalizeValue({},false);
  assert.equal(failed,1);assert.deepEqual(events,[['start',0],['cancel']]);
  events.length=0;g.onBeginValue({x:64,y:14});g.onStartValue();g.onUpdateValue({x:64,y:64});g.onUpdateValue({x:14,y:64});g.onFinalizeValue({},true);
  assert(!events.some(e=>e[0]==='preview'),'crossing the centre cannot jump the value');
  events.length=0;const increase=nodes(tree).find(n=>n.props.accessibilityLabel==='Increase Bass');increase.props.onPress();increase.props.onPress();
  assert.deepEqual(events.filter(e=>e[0]==='commit'),[['commit',.5],['commit',1]],'rapid precision taps accumulate while native commits are pending');
});

test('cancelling a sound knob cancels the live DSP preview without a save',()=>{
  let cancels=0,commits=0;const live={start:()=>({active:()=>true,preview(){},cancel:async()=>{cancels++;},commit:async()=>{commits++;}})};
  const ui=harness('src/SoundStudio.js',['Fader']);const props={label:'Bass',value:0,min:-12,max:12,c:palette(false),live};
  let tree=ui.render('Fader',props);ui.effects();let dial=nodes(tree).find(n=>n.type==='RotaryKnob');
  dial.props.onSlidingStart(0);dial.props.onValueChange(8);dial.props.onCancel();ui.frames();tree=ui.render('Fader',props);
  assert.equal(cancels,1);assert.equal(commits,0);assert.equal(nodes(tree).find(n=>n.type==='RotaryKnob').props.accessibilityValue.now,0);
});

test('scaled dials keep the same angular response in a compact landscape viewport', async () => {
  const geometry=await import('../src/rotaryGeometry.js');
  for(const size of [65,128]){
    const events=[];let ui;
    const Pan=()=>{const g={};for(const name of ['enabled','minDistance','maxPointers','onTouchesDown','onBegin','onStart','onTouchesMove','onUpdate','onFinalize'])g[name]=v=>{g[name+'Value']=v;return g;};return g;};
    ui=harness('src/RotaryKnob.js',['RotaryKnob'],{...geometry,Svg:'Svg',Circle:'Circle',Path:'Path',Animated:{View:'AnimatedView'},Gesture:{Pan},GestureDetector:'GestureDetector',useSharedValue:v=>ui.context.useRef({value:v}).current,useAnimatedStyle:fn=>fn(),runOnJS:fn=>fn});
    const tree=ui.render('RotaryKnob',{size,value:0,minimumValue:-12,maximumValue:12,step:.5,c:palette(false),accessibilityLabel:'Bass',accessibilityValue:{text:'0 dB'},onSlidingStart(){},onValueChange:v=>events.push(v),onSlidingComplete:v=>events.push(v)});ui.effects();
    const face=nodes(tree).find(n=>n.props.testID==='knob-bass'),g=nodes(tree).find(n=>n.type==='GestureDetector').props.gesture;
    assert.equal(face.props.style.height,size);assert.equal(face.props.style.width,size);
    g.onBeginValue({x:size/2,y:14*size/128});g.onStartValue();g.onUpdateValue({x:114*size/128,y:size/2});g.onFinalizeValue({},true);
    assert.deepEqual(events,[8,8],'a quarter turn previews and commits the same value at either size');
  }
});

test('Sound measures the scroll viewport and sizes every dial to fit, then restores portrait size', async () => {
  const {tones}=await import('../src/design.js');const {outputPresets,findOutputPreset}=await import('../src/outputPresets.js');
  const ui=harness('src/SoundStudio.js',['SoundStudio','Fader'],{tones,outputPresets,findOutputPreset,useAppActive:()=>true});
  const props={state:{sound:{}},c:palette(true),command(){},onBack(){},onTimer(){}};
  for(const tab of ['Tone','Output','Playback']){
    let tree=ui.render('SoundStudio',{...props,tab});
    nodes(tree).find(n=>n.type==='ScrollView').props.onLayout({nativeEvent:{layout:{height:234/2.625}}});
    tree=ui.render('SoundStudio',{...props,tab});
    const faders=nodes(tree).filter(n=>typeof n.type==='function'&&n.type.name==='Fader');
    assert(faders.length>0);for(const fader of faders){assert.equal(fader.props.size,65);const faceUI=harness('src/SoundStudio.js',['Fader']);const control=faceUI.render('Fader',fader.props);assert.equal(nodes(control).find(n=>n.type==='RotaryKnob').props.size,65);}
    tree=ui.render('SoundStudio',{...props,tab});nodes(tree).find(n=>n.type==='ScrollView').props.onLayout({nativeEvent:{layout:{height:500}}});
    tree=ui.render('SoundStudio',{...props,tab});assert(nodes(tree).filter(n=>typeof n.type==='function'&&n.type.name==='Fader').every(n=>n.props.size===128));
  }
});
