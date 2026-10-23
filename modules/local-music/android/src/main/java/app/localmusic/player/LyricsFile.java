package app.localmusic.player;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;

/** Copy validated text into existing per-song preferences; no persistent file grant is needed. */
final class LyricsFile {
    static final int LIMIT = 512 * 1024;
    static String read(InputStream stream) throws IOException {
        if (stream == null) throw new IOException("File unavailable");
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        byte[] chunk = new byte[4096];
        int count;
        while ((count = stream.read(chunk)) != -1) {
            if (bytes.size() + count > LIMIT) throw new IOException("Lyrics file is too large");
            bytes.write(chunk, 0, count);
        }
        String text = StandardCharsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
            .decode(ByteBuffer.wrap(bytes.toByteArray())).toString();
        if (text.startsWith("\uFEFF")) text = text.substring(1);
        if (text.trim().isEmpty() || text.indexOf('\0') >= 0) throw new IOException("Choose a text lyrics file");
        return text;
    }
}
