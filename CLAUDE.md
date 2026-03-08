# CLAUDE.md

이 파일은 Claude Code가 이 프로젝트를 이해하기 위한 컨텍스트를 제공합니다.

## 프로젝트 개요
한국어 게임 포털 사이트. 스도쿠와 스파이더 카드놀이를 제공합니다.

## 기술 스택
- 프론트엔드: 순수 HTML5 / CSS3 / Vanilla JavaScript (프레임워크 없음)
- 백엔드: Node.js + Express + SQLite (스도쿠 인증/저장용)
- 배포: Docker (nginx:alpine)

## 프로젝트 구조
```
public/
  index.html     - 게임 포털 (게임 선택 화면)
  portal.css     - 포털 스타일링
  sudoku/        - 스도쿠 게임
    index.html   - 스도쿠 HTML
    app.js       - 스도쿠 게임 로직
    style.css    - 스도쿠 스타일링
    puzzles.js   - 퍼즐 데이터 (40개)
  spider/        - 스파이더 카드놀이
    index.html   - 스파이더 HTML
    app.js       - 스파이더 게임 로직
    style.css    - 스파이더 스타일링
server.js        - Express 백엔드 (인증/데이터 API)
Dockerfile       - nginx 기반 컨테이너
```

## 주요 규칙
- 모든 UI 텍스트는 한국어
- 외부 라이브러리/CDN 사용 금지 (순수 Vanilla JS)
- localStorage로 진행 상황 저장
- 퍼즐 데이터는 81자리 문자열 형식 (0=빈칸)

## 브랜치 & PR 규칙
- 기능 추가와 버그 수정은 반드시 별도의 브랜치/PR로 분리
- 하나의 PR에 여러 성격의 변경을 섞지 않기
- 브랜치 네이밍: `feature/기능명`, `fix/버그명`

## 빌드 & 실행
```bash
npm start          # Express 서버 (포트 3000)
docker build -t games .
docker run -p 8080:80 games
```

## 게임별 상태 구조
### 스도쿠
- `state.board`: 9x9 현재 보드
- `state.solution`: 9x9 정답
- `state.given`: 9x9 주어진 셀 여부
- `state.memos`: 9x9 메모 Set 배열
- localStorage 키: `sudoku-progress`, `sudoku-completed`

### 스파이더 카드놀이
- `state.columns`: 10개 열의 카드 배열
- `state.stock`: 딜할 남은 카드
- `state.completed`: 완성된 수트 세트
- 1/2/4 수트 모드 지원
- 되돌리기(undo) 기능
