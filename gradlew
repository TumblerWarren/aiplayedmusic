#!/bin/sh
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -f "$project_dir/gradle/wrapper/gradle-wrapper.jar" ]; then
  exec java -classpath "$project_dir/gradle/wrapper/gradle-wrapper.jar" org.gradle.wrapper.GradleWrapperMain "$@"
fi
if [ -x "$project_dir/.build-tools/gradle-8.11.1/bin/gradle" ]; then
  export ANDROID_HOME="${ANDROID_HOME:-$project_dir/.build-tools/android-sdk}"
  exec "$project_dir/.build-tools/gradle-8.11.1/bin/gradle" -p "$project_dir" "$@"
fi
if command -v gradle >/dev/null 2>&1; then exec gradle -p "$project_dir" "$@"; fi
echo 'Gradle wrapper JAR is not installed. Run scripts/bootstrap.sh or open this project in Android Studio.' >&2
exit 1
