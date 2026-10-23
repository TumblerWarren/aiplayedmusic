import com.sun.source.util.JavacTask;
import javax.tools.*;
import java.nio.file.*;
import java.util.*;

/** Parse-only check: deliberately does not claim Android type checking. */
public class CheckJavaSyntax {
    public static void main(String[] args) throws Exception {
        JavaCompiler compiler=ToolProvider.getSystemJavaCompiler();
        if(compiler==null)throw new IllegalStateException("JDK compiler required");
        List<java.io.File> files=new ArrayList<>();
        try(var paths=Files.walk(Path.of(args[0]))) {paths.filter(p->p.toString().endsWith(".java")).forEach(p->files.add(p.toFile()));}
        DiagnosticCollector<JavaFileObject> diagnostics=new DiagnosticCollector<>();
        try(StandardJavaFileManager manager=compiler.getStandardFileManager(diagnostics,null,null)) {
            JavacTask task=(JavacTask)compiler.getTask(null,manager,diagnostics,List.of("-proc:none","--source","17"),null,manager.getJavaFileObjectsFromFiles(files));
            task.parse();
            boolean error=false;
            for(var d:diagnostics.getDiagnostics()) if(d.getKind()==Diagnostic.Kind.ERROR){System.err.println(d);error=true;}
            if(error)System.exit(1);
            System.out.println("PASS: Java 17 syntax parsed for "+files.size()+" files. Android type checking and APK compilation NOT performed.");
        }
    }
}
