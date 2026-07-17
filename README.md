# NEF·JPG → WEBP 변환기

브라우저에서 바로 이미지를 WEBP로 변환하는 정적 웹 페이지입니다. NEF(니콘 RAW)는 [LibRaw-Wasm](https://github.com/ybouane/LibRaw-Wasm)으로 실제 raw 센서 데이터를 디코딩(카메라 화이트밸런스 적용)하고, JPG·PNG 등은 그대로 불러옵니다. 서버로 파일을 업로드하지 않고 Canvas API와 WebAssembly를 이용해 브라우저 안에서만 처리합니다.

## 기능

- NEF(니콘 RAW), JPG, PNG 등 다양한 이미지 업로드 (드래그 앤 드롭 또는 클릭)
- NEF는 카메라의 baked-in 프리뷰 JPEG가 아니라 실제 raw 데이터를 디모자이킹해서 색을 현상 (raw 엔진 로드에 실패하면 프리뷰 JPEG 추출 방식으로 자동 대체)
- 품질 슬라이더로 WebP 압축률 직접 조정 (기본 92)
- 장축(긴 변) 제한으로 리사이즈 (기본 4000px, 0이면 원본 해상도 유지)
- 항목별 다운로드 / 삭제
- 전체 ZIP 일괄 다운로드 (순수 JS로 구현, 무압축 저장 방식)
- 디시인사이드 갤러리 업로드 팁 포함 (849px 강제 축소 회피, 업로드 용량 제한 등)

## vendor/libraw-wasm

[LibRaw-Wasm](https://github.com/ybouane/LibRaw-Wasm) 1.6.0의 빌드 산출물(`index.js`, `worker.js`, `libraw.js`, `libraw.wasm`)을 이 저장소에 그대로 커밋해서 같은 오리진에서 서빙합니다. CDN에서 바로 로드하면 라이브러리가 내부적으로 `new Worker(new URL("./worker.js", import.meta.url))`로 워커를 띄우는데, CORS 헤더가 열려 있어도 브라우저가 크로스오리진 Worker 생성 자체를 막기 때문입니다(`SecurityError: Failed to construct 'Worker'`). `.nojekyll`은 GitHub Pages(Jekyll)가 `vendor/` 아래 파일을 정적 에셋 배포에서 빼먹지 않도록 추가한 것입니다.

LibRaw-Wasm 자체는 ISC 라이선스이고, 내부적으로 감싸고 있는 [LibRaw](https://www.libraw.org/)는 LGPL-2.1 / CDDL-1.0 중 선택 가능한 라이선스입니다. 자세한 조건은 각 프로젝트 문서를 참고하세요.

## 로컬 실행

정적 파일이라 별도 빌드 없이 바로 열립니다. 다만 `vendor/libraw-wasm`을 모듈로 불러오려면 `file://`이 아니라 로컬 서버로 열어야 합니다:

```bash
python3 -m http.server 8000
```

## 배포

GitHub Pages로 저장소 루트를 그대로 배포합니다 (Settings → Pages → Branch: main / root).
