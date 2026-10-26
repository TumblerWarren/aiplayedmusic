package app.localmusic.player;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import app.localmusic.engine.R;

/** Media cards need square pixels, not a launcher-controlled adaptive mask. */
final class NotificationArtwork {
    private NotificationArtwork() {}

    static Bitmap create(Context context) {
        Bitmap bitmap = Bitmap.createBitmap(256, 256, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(Color.rgb(255, 251, 246));
        // The shared foreground already contains the approved icon's safe inset.
        Drawable foreground = context.getResources().getDrawable(R.drawable.aiplayed_launcher_foreground, null).mutate();
        foreground.setBounds(0, 0, bitmap.getWidth(), bitmap.getHeight());
        foreground.draw(canvas);
        return bitmap;
    }
}
