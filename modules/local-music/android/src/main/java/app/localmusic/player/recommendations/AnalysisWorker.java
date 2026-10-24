package app.localmusic.player.recommendations;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

public final class AnalysisWorker extends Worker {
    public AnalysisWorker(@NonNull Context context,@NonNull WorkerParameters parameters){super(context,parameters);}
    @NonNull @Override public Result doWork(){
        RecommendationEngine engine=RecommendationEngine.get(getApplicationContext());
        if(!engine.enabled())return Result.success();
        return engine.run(false,this::isStopped)?Result.success():Result.retry();
    }
}
