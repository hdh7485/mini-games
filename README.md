# 스도쿠

브라우저에서 즐기는 스도쿠 웹 앱입니다.

## 기능
- 4가지 난이도: 쉬움, 보통, 어려움, 전문가
- 난이도별 10개 퍼즐 (총 40개)
- 메모(연필 표시) 기능
- 힌트 기능 (퍼즐당 3회)
- 오답 검사
- 진행 상황 자동 저장
- 타이머
- 키보드 지원 (숫자키, 방향키, M키 메모 토글)

## 실행 방법

### Docker
```bash
docker build -t sudoku .
docker run -p 8080:80 sudoku
```
http://localhost:8080 으로 접속

### 직접 실행
정적 파일이므로 아무 웹 서버로 서빙하면 됩니다:
```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve .
```

## 조작법
| 입력 | 동작 |
|------|------|
| 숫자 1-9 | 셀에 숫자 입력 |
| Backspace / Delete | 셀 지우기 |
| 방향키 | 셀 이동 |
| M | 메모 모드 토글 |

## 기술 스택
- HTML5 / CSS3 / Vanilla JavaScript
- Docker (nginx:alpine)
- 외부 의존성 없음
