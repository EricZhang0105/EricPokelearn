#!/bin/bash
# PokeLearn 安卓离线版构建脚本（不依赖 Gradle / Android Studio）
set -e
# 路径自适应：源码在仓库里，JDK/Android SDK 放在同级的 PokeLearnMobile 工具链目录
PROJ="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$PROJ/../.." && pwd)"
WORKSPACE="$(cd "$ROOT/.." && pwd)"
BASE="${POKELEARN_TOOLCHAIN:-$WORKSPACE/PokeLearnMobile}"
OUT="${POKELEARN_INSTALLERS:-$WORKSPACE/PokeLearnInstallers/android}"
JAVA_BIN=$(find "$BASE/jdk" -type f -path "*/Contents/Home/bin/java" | head -1)
[ -n "$JAVA_BIN" ] || { echo "找不到 JDK，请先配置 $BASE/jdk"; exit 1; }
JH="$(cd "$(dirname "$JAVA_BIN")/.." && pwd)"
SDK=$BASE/android-sdk
BT=$SDK/build-tools/34.0.0
AJ=$SDK/platforms/android-34/android.jar
APK_NAME=PokeLearn-Android-v25.apk
OUT_APK="$OUT/$APK_NAME"
export JAVA_HOME="$JH"
export PATH="$JH/bin:$PATH"
export OUT_APK

echo "[1/8] 重新生成 v25 静态镜像 ..."
(cd "$ROOT" && node tools/build_cloud_bundle.js >/dev/null)

echo "[2/8] 准备离线 assets ..."
python3 "$PROJ/prepare_assets.py"

echo "[3/8] 编译资源 ..."
cd "$PROJ"
mkdir -p out/compiled out/classes out/dex out/gen
"$BT/aapt2" compile --dir res -o out/compiled/res.zip

echo "[4/8] 链接 APK 骨架 ..."
"$BT/aapt2" link -o out/base.apk \
  -I "$AJ" \
  --manifest AndroidManifest.xml \
  -R out/compiled/res.zip \
  -A assets \
  --java out/gen \
  --min-sdk-version 24 --target-sdk-version 34 \
  --version-code 25 --version-name 25.0 \
  --auto-add-overlay

echo "[5/8] 编译 Java / 转 dex ..."
"$JH/bin/javac" -source 8 -target 8 -nowarn -encoding UTF-8 \
  -cp "$AJ" -d out/classes \
  src/com/ericzhang/pokelearn/MainActivity.java \
  out/gen/com/ericzhang/pokelearn/R.java
"$BT/d8" --lib "$AJ" --min-api 24 --output out/dex \
  $(find out/classes -name '*.class' | sort)

echo "[6/8] 合并 dex + 对齐 ..."
python3 - <<'PY'
import zipfile, shutil
src='out/base.apk'; dst='out/withdex.apk'
shutil.copy2(src,dst)
with zipfile.ZipFile(dst,'a',compression=zipfile.ZIP_DEFLATED) as z:
    z.write('out/dex/classes.dex','classes.dex')
print('classes.dex 已写入')
PY
"$BT/zipalign" -f -p 4 out/withdex.apk out/aligned.apk

echo "[7/8] 生成签名并签名 ..."
if [ ! -f out/pokelearn.jks ]; then
  "$JH/bin/keytool" -genkeypair -keystore out/pokelearn.jks \
    -alias pokelearn -keyalg RSA -keysize 2048 -validity 10950 \
    -storepass pokelearn -keypass pokelearn \
    -dname "CN=PokeLearn, OU=Learning, O=PokeLearn, L=Singapore, S=Singapore, C=SG" \
    >/dev/null 2>&1
fi
mkdir -p "$OUT"
"$BT/apksigner" sign \
  --ks out/pokelearn.jks --ks-pass pass:pokelearn --key-pass pass:pokelearn \
  --v1-signing-enabled true --v2-signing-enabled true \
  --out "$OUT_APK" out/aligned.apk

echo "[8/8] 验证 ..."
"$BT/apksigner" verify --verbose "$OUT_APK" | head -12
echo "--- badging ---"
"$BT/aapt" dump badging "$OUT_APK" | head -8
echo "--- 内嵌资源抽样 ---"
python3 - <<'PY'
import zipfile, os
p=os.environ['OUT_APK']
z=zipfile.ZipFile(p)
names=z.namelist()
for k in ['classes.dex','assets/www/index.html','assets/www/js/question-engine.js',
          'assets/www/js/read-passages.js','assets/www/audio/sfx/rocket_line.m4a','resources.arsc']:
    print(('OK  ' if k in names else 'MISS'),k, z.getinfo(k).file_size if k in names else '')
print('assets 文件数:',sum(1 for n in names if n.startswith('assets/www/')))
PY
ls -lh "$OUT_APK"
echo "APK_BUILD_OK"
