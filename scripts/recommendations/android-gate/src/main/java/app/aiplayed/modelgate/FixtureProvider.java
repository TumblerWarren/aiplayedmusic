package app.aiplayed.modelgate;
import android.content.*;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import java.io.*;
public final class FixtureProvider extends ContentProvider {
 public boolean onCreate(){return true;}
 public ParcelFileDescriptor openFile(Uri uri,String mode)throws FileNotFoundException{
  if(!"fixture.wav".equals(uri.getLastPathSegment())||!"r".equals(mode))throw new FileNotFoundException();
  return ParcelFileDescriptor.open(new File(getContext().getFilesDir(),"fixture.wav"),ParcelFileDescriptor.MODE_READ_ONLY);
 }
 public String getType(Uri uri){return "audio/wav";}
 public Cursor query(Uri uri,String[] projection,String selection,String[] args,String order){return null;}
 public Uri insert(Uri uri,ContentValues values){return null;}
 public int delete(Uri uri,String selection,String[] args){return 0;}
 public int update(Uri uri,ContentValues values,String selection,String[] args){return 0;}
}
