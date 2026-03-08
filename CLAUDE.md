# CLAUDE.md

이 파일은 Claude Code가 이 프로젝트를 이해하기 위한 컨텍스트를 제공합니다.

## 프로젝트 개요
한국어 스도쿠 웹 애플리케이션. 4가지 난이도(쉬움/보통/어려움/전문가)별 10개씩 총 40개 퍼즐을 제공합니다.

## 기술 스택
- 프론트엔드: 순수 HTML5 / CSS3 / Vanilla JavaScript (프레임워크 없음)
- 배포: Docker (nginx:alpine)

## 프로젝트 구조
```
app.js       - 게임 로직, 상태 관리, 이벤트 핸들링
index.html   - 메인 HTML (단일 페이지 앱)
style.css    - 전체 스타일링 (CSS 변수, 반응형)
puzzles.js   - 퍼즐 데이터 (난이도별 10개, 총 40개)
Dockerfile   - nginx 기반 컨테이너
```

## 주요 규칙
- 모든 UI 텍스트는 한국어
- 외부 라이브러리/CDN 사용 금지 (순수 Vanilla JS)
- localStorage로 진행 상황 저장
- 퍼즐 데이터는 81자리 문자열 형식 (0=빈칸)

## 빌드 & 실행
```bash
docker build -t sudoku .
docker run -p 8080:80 sudoku
```
브라우저에서 http://localhost:8080 접속

## 게임 상태 구조
- `state.board`: 9x9 현재 보드
- `state.solution`: 9x9 정답
- `state.given`: 9x9 주어진 셀 여부
- `state.memos`: 9x9 메모 Set 배열
- localStorage 키: `sudoku-progress` (진행), `sudoku-completed` (완료)
