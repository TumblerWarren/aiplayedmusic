import javax.tools.ToolProvider;
import java.nio.file.*;
import java.net.*;

/** Java source launcher also works on runtimes shipping jdk.compiler without a javac executable. */
class RunAudioTests {
    public static void main(String[] args)throws Exception {
        var compiler=ToolProvider.getSystemJavaCompiler();
        if(compiler==null)throw new IllegalStateException("Audio verification requires a full JDK");
        Path output=Files.createTempDirectory("aiplayed-audio-tests-");
        int status=compiler.run(null,System.out,System.err,"-d",output.toString(),
            "modules/local-music/android/src/main/java/app/localmusic/player/DspCore.java",
            "modules/local-music/android/src/main/java/app/localmusic/player/TonePresets.java",
            "scripts/DspTests.java","scripts/DspRegressionTests.java");
        if(status!=0)System.exit(status);
        try(var loader=new URLClassLoader(new URL[]{output.toUri().toURL()})) {
            loader.loadClass("app.localmusic.player.DspTests").getMethod("main",String[].class).invoke(null,(Object)args);
            loader.loadClass("app.localmusic.player.DspRegressionTests").getMethod("main",String[].class).invoke(null,(Object)args);
        }finally{try(var files=Files.walk(output)){files.sorted(java.util.Comparator.reverseOrder()).forEach(p->{try{Files.delete(p);}catch(Exception ignored){}});}}
    }
}
