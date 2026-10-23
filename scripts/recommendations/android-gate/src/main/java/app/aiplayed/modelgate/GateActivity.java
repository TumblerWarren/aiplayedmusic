package app.aiplayed.modelgate;
/** Gives native playback checks the same foreground eligibility as the real app. */
public final class GateActivity extends android.app.Activity {
 @Override public void onCreate(android.os.Bundle state){super.onCreate(state);android.widget.TextView view=new android.widget.TextView(this);view.setText("Aiplayed native playback checks");setContentView(view);}
}
