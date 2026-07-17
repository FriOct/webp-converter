# JPG → WEBP 변환기

브라우저에서 바로 JPG 이미지를 WEBP로 변환하는 정적 웹 페이지입니다. 서버로 파일을 업로드하지 않고 Canvas API를 이용해 클라이언트에서만 처리합니다.

## 기능

- 드래그 앤 드롭 또는 클릭으로 여러 장의 JPG 업로드
- 자동 모드: 결과 파일이 20MB를 넘지 않는 선에서 최고 품질 자동 선택
- 수동 모드: 품질 슬라이더로 직접 지정
- 긴 변이 4000px를 넘으면 자동 축소 (옵션으로 끌 수 있음)
- 개별 다운로드 또는 전체 ZIP 다운로드

## 로컬 실행

정적 파일이라 별도 빌드 없이 바로 열립니다.

```bash
open index.html
```

또는 로컬 서버로:

```bash
python3 -m http.server 8000
```

## 배포

GitHub Pages로 저장소 루트를 그대로 배포합니다 (Settings → Pages → Branch: main / root).
