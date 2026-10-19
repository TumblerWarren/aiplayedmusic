package app.localmusic.player;

import android.content.*;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.view.*;
import android.widget.*;

final class Ui {
    static int accent=Color.rgb(255,100,47), ink=Color.rgb(27,28,30), muted=Color.rgb(126,128,133), bg=Color.rgb(250,250,250), card=Color.WHITE, line=Color.rgb(237,237,239);
    static int dp(Context c,float d){return (int)(d*c.getResources().getDisplayMetrics().density+.5f);}
    static GradientDrawable shape(int color,int radius){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(radius);return d;}
    static void theme(boolean dark){ink=Color.parseColor(dark?"#F4F4F5":"#1B1C1E");muted=Color.parseColor(dark?"#A4A4AD":"#7E8085");bg=Color.parseColor(dark?"#111113":"#FAFAFA");card=Color.parseColor(dark?"#202023":"#FFFFFF");line=Color.parseColor(dark?"#303034":"#EDEDEF");}
    static TextView text(Context c,String text,int size,int color){TextView t=new TextView(c);t.setText(text);t.setTextSize(size);t.setTextColor(color);t.setGravity(Gravity.CENTER_VERTICAL);t.setFontFeatureSettings("kern");return t;}
    static void bold(TextView t){t.setTypeface(android.graphics.Typeface.create("sans-serif-medium",0));}
    static class Icon extends View {
        String name; int color; Paint p=new Paint(3); Canvas canvas;
        Icon(Context c,String name,int color){super(c);this.name=name;this.color=color;setContentDescription(name);setMinimumWidth(dp(c,44));setMinimumHeight(dp(c,44));setFocusable(true);}
        void name(String n){name=n;setContentDescription(n);invalidate();}
        void color(int c){color=c;invalidate();}
        void ln(float... a){Path q=new Path();q.moveTo(a[0],a[1]);for(int i=2;i<a.length;i+=2)q.lineTo(a[i],a[i+1]);canvas.drawPath(q,p);}
        void circle(float x,float y,float r){canvas.drawCircle(x,y,r,p);}
        void fill(boolean b){p.setStyle(b?Paint.Style.FILL:Paint.Style.STROKE);}
        @Override protected void onDraw(Canvas c){super.onDraw(c);canvas=c;float size=Math.min(getWidth(),getHeight())*.51f;c.save();c.translate((getWidth()-size)/2,(getHeight()-size)/2);c.scale(size/24,size/24);p.setColor(color);p.setStrokeWidth(1.8f);p.setStrokeCap(Paint.Cap.ROUND);p.setStrokeJoin(Paint.Join.ROUND);fill(false);
            switch(name){
                case "play":fill(true);ln(8,4,21,12,8,20,8,4);break;
                case "pause":p.setStrokeWidth(4);ln(8,5,8,19);ln(16,5,16,19);break;
                case "next":fill(true);ln(5,5,17,12,5,19,5,5);fill(false);ln(19,5,19,19);break;
                case "previous":fill(true);ln(19,5,7,12,19,19,19,5);fill(false);ln(5,5,5,19);break;
                case "search":circle(10,10,7);ln(15,15,21,21);break;
                case "back":ln(15,5,8,12,15,19);break;
                case "down":ln(5,9,12,16,19,9);break;
                case "more":fill(true);circle(12,5,1.5f);circle(12,12,1.5f);circle(12,19,1.5f);break;
                case "queue":ln(3,5,21,5);ln(3,11,15,11);ln(3,17,12,17);fill(true);ln(17,14,23,18,17,22,17,14);break;
                case "shuffle":ln(3,5,6,5,17,19,21,19);ln(17,15,21,19,17,23);ln(3,19,6,19,17,5,21,5);ln(17,1,21,5,17,9);break;
                case "repeat":case "repeat one":ln(4,9,4,6,20,6,20,9);ln(17,3,20,6,23,3);ln(20,15,20,18,4,18,4,15);ln(1,21,4,18,7,21);if(name.equals("repeat one")){p.setTextSize(9);fill(true);c.drawText("1",10,15,p);}break;
                case "heart":case "favorite":Path h=new Path();h.moveTo(12,21);h.cubicTo(8,17,1,12,2,7);h.cubicTo(3,1,10,1,12,6);h.cubicTo(14,1,21,1,22,7);h.cubicTo(23,12,16,17,12,21);fill(name.equals("favorite"));c.drawPath(h,p);break;
                case "note":ln(10,17,10,4,20,2,20,15);circle(6,18,4);circle(16,16,4);break;
                case "album":circle(12,12,10);circle(12,12,3);break;
                case "artist":circle(12,7,4);c.drawArc(3,13,21,29,180,180,false,p);break;
                case "folder":ln(2,20,2,5,9,5,11,8,22,8,22,20,2,20);break;
                case "settings":circle(12,12,4);for(int i=0;i<8;i++){c.save();c.rotate(i*45,12,12);ln(12,1,12,4);c.restore();}circle(12,12,8);break;
                case "clock":circle(12,12,10);ln(12,6,12,12,16,14);break;
                case "plus":ln(12,4,12,20);ln(4,12,20,12);break;
                case "close":ln(5,5,19,19);ln(19,5,5,19);break;
                case "sort":ln(4,6,20,6);ln(4,12,15,12);ln(4,18,10,18);break;
                case "equalizer":ln(5,3,5,21);ln(12,3,12,21);ln(19,3,19,21);p.setStrokeWidth(5);ln(5,7,5,10);ln(12,14,12,17);ln(19,5,19,8);break;
                default:ln(8,5,15,12,8,19);
            } c.restore();
        }
    }
    static class Artwork extends View {
        Bitmap bitmap; Song song; Paint p=new Paint(3); boolean round;
        Artwork(Context c){super(c);setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);}
        void set(Song s,Bitmap b){song=s;bitmap=b;invalidate();}
        @Override protected void onDraw(Canvas c){super.onDraw(c);float w=getWidth(),h=getHeight();Path path=new Path();path.addRoundRect(0,0,w,h,dp(getContext(),round?1000:12),dp(getContext(),round?1000:12),Path.Direction.CW);c.save();c.clipPath(path);
            if(bitmap!=null){float scale=Math.max(w/bitmap.getWidth(),h/bitmap.getHeight());float bw=bitmap.getWidth()*scale,bh=bitmap.getHeight()*scale;c.drawBitmap(bitmap,null,new RectF((w-bw)/2,(h-bh)/2,(w+bw)/2,(h+bh)/2),p);}else{
                int[] colors={0xFFD7A678,0xFF889BA4,0xFF879B87,0xFFAA91A8,0xFFAD9486,0xFF7D8DA9};int n=song==null?0:(int)Math.floorMod(song.albumId,(long)colors.length);int color=colors[n];p.setShader(new LinearGradient(0,0,w,h,new int[]{color,darken(color)},null,Shader.TileMode.CLAMP));c.drawRect(0,0,w,h,p);p.setShader(null);p.setColor(0x18FFFFFF);c.drawCircle(w*.8f,h*.2f,w*.6f,p);c.drawCircle(w*.1f,h*.9f,w*.5f,p);
                p.setColor(0xAFFFFFFF);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(Math.max(2,w*.018f));c.drawCircle(w/2,h/2,w*.28f,p);c.drawCircle(w/2,h/2,w*.09f,p);p.setStyle(Paint.Style.FILL);c.drawCircle(w/2,h/2,w*.025f,p);
            } c.restore();
        }
        private int darken(int color){return Color.rgb((int)(Color.red(color)*.64),(int)(Color.green(color)*.64),(int)(Color.blue(color)*.64));}
    }
}
