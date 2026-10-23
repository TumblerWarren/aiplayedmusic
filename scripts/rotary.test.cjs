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
