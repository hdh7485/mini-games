// ===== 인증 상태 =====
const auth = {
    token: null,
    username: null,
    isGuest: false,
};

// ===== API 헬퍼 =====
async function api(method, path, body) {
    const opts = {
        method,
        headers: { "Content-Type": "application/json" },
    };
    if (auth.token) opts.headers["Authorization"] = `Bearer ${auth.token}`;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`/api${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "요청 실패");
    return data;
}

// ===== 상태 관리 =====
const state = {
    currentDifficulty: null,
    currentPuzzleIndex: null,
    board: [],
    solution: [],
    given: [],
    memos: [],
    selectedCell: null,
    memoMode: false,
    hints: 3,
    timerSeconds: 0,
    timerInterval: null,
    errors: new Set(),  // "row,col" 형태
    isPaused: false,
};

// 서버/로컬 데이터 캐시
let cachedProgress = {};
let cachedCompleted = {};

// ===== 데이터 로드/저장 (서버 or localStorage) =====
async function loadAllData() {
    if (auth.isGuest) {
        try {
            cachedProgress = JSON.parse(localStorage.getItem("sudoku-progress")) || {};
        } catch { cachedProgress = {}; }
        try {
            cachedCompleted = JSON.parse(localStorage.getItem("sudoku-completed")) || {};
        } catch { cachedCompleted = {}; }
        return;
    }
    try {
        const data = await api("GET", "/data");
        cachedProgress = data.progress || {};
        // 서버 completed format: { difficulty: [{index, clearTime}] }
        // 내부 format: { difficulty: [index, ...] }
        cachedCompleted = {};
        for (const [diff, items] of Object.entries(data.completed || {})) {
            cachedCompleted[diff] = items.map(it => it.index);
        }
    } catch (e) {
        console.error("데이터 로드 실패:", e);
    }
}

function getProgress() {
    return cachedProgress;
}

async function saveProgress() {
    const key = `${state.currentDifficulty}_${state.currentPuzzleIndex}`;
    const data = {
        board: state.board.map(r => [...r]),
        memos: state.board.map((_, ri) => state.memos[ri].map(s => [...s])),
        timerSeconds: state.timerSeconds,
        hints: state.hints,
    };
    cachedProgress[key] = data;

    if (auth.isGuest) {
        localStorage.setItem("sudoku-progress", JSON.stringify(cachedProgress));
    } else {
        try { await api("POST", "/progress", { puzzleKey: key, data }); } catch {}
    }
}

function loadSavedState(difficulty, index) {
    const key = `${difficulty}_${index}`;
    return cachedProgress[key] || null;
}

async function clearSavedState(difficulty, index) {
    const key = `${difficulty}_${index}`;
    delete cachedProgress[key];

    if (auth.isGuest) {
        localStorage.setItem("sudoku-progress", JSON.stringify(cachedProgress));
    } else {
        try { await api("DELETE", `/progress/${key}`); } catch {}
    }
}

function getCompletedPuzzles() {
    return cachedCompleted;
}

async function markCompleted(difficulty, index) {
    if (!cachedCompleted[difficulty]) cachedCompleted[difficulty] = [];
    if (!cachedCompleted[difficulty].includes(index)) {
        cachedCompleted[difficulty].push(index);
    }

    if (auth.isGuest) {
        localStorage.setItem("sudoku-completed", JSON.stringify(cachedCompleted));
        delete cachedProgress[`${difficulty}_${index}`];
        localStorage.setItem("sudoku-progress", JSON.stringify(cachedProgress));
    } else {
        try {
            await api("POST", "/completed", { difficulty, puzzleIndex: index, clearTime: state.timerSeconds });
        } catch {}
    }
}

function isCompleted(difficulty, index) {
    return cachedCompleted[difficulty]?.includes(index) || false;
}

function getCompletedCount(difficulty) {
    return cachedCompleted[difficulty]?.length || 0;
}

function hasSavedState(difficulty, index) {
    return !!cachedProgress[`${difficulty}_${index}`];
}

// ===== 화면 전환 =====
function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById(screenId).classList.add("active");
}

// ===== 메인 화면 =====
function updateHomeProgress() {
    for (const diff of ["easy", "medium", "hard", "expert"]) {
        const total = PUZZLES[diff].length;
        const done = getCompletedCount(diff);
        const pct = (done / total) * 100;
        document.getElementById(`progress-${diff}`).style.width = `${pct}%`;
        document.getElementById(`progress-text-${diff}`).textContent = `${done} / ${total}`;
    }
}

// ===== 퍼즐 선택 화면 =====
function showPuzzleSelect(difficulty) {
    state.currentDifficulty = difficulty;
    document.getElementById("puzzle-select-title").textContent = DIFFICULTY_NAMES[difficulty];

    const grid = document.getElementById("puzzle-grid");
    grid.innerHTML = "";

    PUZZLES[difficulty].forEach((_, i) => {
        const btn = document.createElement("button");
        btn.className = "puzzle-cell";
        btn.textContent = i + 1;

        if (isCompleted(difficulty, i)) {
            btn.classList.add("completed");
            btn.textContent = "\u2713";
        } else if (hasSavedState(difficulty, i)) {
            btn.classList.add("in-progress");
        }

        btn.addEventListener("click", () => startGame(difficulty, i));
        grid.appendChild(btn);
    });

    showScreen("puzzle-select-screen");
}

// ===== 문자열 -> 9x9 배열 =====
function stringToGrid(str) {
    const grid = [];
    for (let r = 0; r < 9; r++) {
        grid.push([]);
        for (let c = 0; c < 9; c++) {
            grid[r].push(parseInt(str[r * 9 + c], 10));
        }
    }
    return grid;
}

// ===== 게임 시작 =====
function startGame(difficulty, index) {
    state.currentDifficulty = difficulty;
    state.currentPuzzleIndex = index;
    state.memoMode = false;
    state.errors = new Set();
    state.selectedCell = null;

    const puzzleData = PUZZLES[difficulty][index];
    state.solution = stringToGrid(puzzleData.solution);
    const puzzleGrid = stringToGrid(puzzleData.puzzle);

    state.given = puzzleGrid.map(r => r.map(v => v !== 0));

    const saved = loadSavedState(difficulty, index);
    if (saved) {
        state.board = saved.board.map(r => [...r]);
        state.memos = saved.memos.map(r => r.map(s => new Set(s)));
        state.timerSeconds = saved.timerSeconds;
        state.hints = saved.hints;
    } else {
        state.board = puzzleGrid.map(r => [...r]);
        state.memos = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
        state.timerSeconds = 0;
        state.hints = 3;
    }

    document.getElementById("game-title").textContent =
        `${DIFFICULTY_NAMES[difficulty]} #${index + 1}`;
    document.getElementById("hint-count").textContent = state.hints;

    updateMemoButton();
    renderBoard();
    startTimer();
    showScreen("game-screen");
}

// ===== 타이머 =====
function startTimer() {
    clearInterval(state.timerInterval);
    updateTimerDisplay();
    state.timerInterval = setInterval(() => {
        state.timerSeconds++;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    clearInterval(state.timerInterval);
}

function pauseGame() {
    if (state.isPaused) return;
    state.isPaused = true;
    stopTimer();
    document.getElementById("pause-overlay").classList.add("active");
}

function resumeGame() {
    if (!state.isPaused) return;
    state.isPaused = false;
    document.getElementById("pause-overlay").classList.remove("active");
    startTimer();
}

function updateTimerDisplay() {
    const min = Math.floor(state.timerSeconds / 60).toString().padStart(2, "0");
    const sec = (state.timerSeconds % 60).toString().padStart(2, "0");
    document.getElementById("timer").textContent = `${min}:${sec}`;
}

// ===== 보드 렌더링 =====
function renderBoard() {
    const table = document.getElementById("sudoku-board");
    table.innerHTML = "";

    for (let r = 0; r < 9; r++) {
        const tr = document.createElement("tr");
        for (let c = 0; c < 9; c++) {
            const td = document.createElement("td");
            const val = state.board[r][c];

            if (state.given[r][c]) {
                td.classList.add("given");
                td.textContent = val;
            } else if (val !== 0) {
                td.classList.add("input");
                td.textContent = val;
                if (state.errors.has(`${r},${c}`)) {
                    td.classList.add("error");
                }
            } else {
                const memos = state.memos[r][c];
                if (memos.size > 0) {
                    const memoDiv = document.createElement("div");
                    memoDiv.className = "memo-grid";
                    for (let n = 1; n <= 9; n++) {
                        const span = document.createElement("span");
                        span.textContent = memos.has(n) ? n : "";
                        memoDiv.appendChild(span);
                    }
                    td.appendChild(memoDiv);
                }
            }

            if (state.selectedCell) {
                const { row: sr, col: sc } = state.selectedCell;
                if (r === sr && c === sc) {
                    td.classList.add("selected");
                } else if (r === sr || c === sc || (Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(c / 3) === Math.floor(sc / 3))) {
                    td.classList.add("highlighted");
                }
                const selectedVal = state.board[sr][sc];
                if (selectedVal !== 0 && val === selectedVal && !(r === sr && c === sc)) {
                    td.classList.add("same-num");
                }
            }

            td.addEventListener("click", () => selectCell(r, c));
            tr.appendChild(td);
        }
        table.appendChild(tr);
    }
}

// ===== 셀 선택 =====
function selectCell(row, col) {
    if (state.isPaused) return;
    state.selectedCell = { row, col };
    renderBoard();
}

// ===== 숫자 입력 =====
function inputNumber(num) {
    if (state.isPaused) return;
    if (!state.selectedCell) return;
    const { row, col } = state.selectedCell;
    if (state.given[row][col]) return;

    if (num === 0) {
        state.board[row][col] = 0;
        state.memos[row][col].clear();
        state.errors.delete(`${row},${col}`);
    } else if (state.memoMode) {
        if (state.board[row][col] !== 0) {
            state.board[row][col] = 0;
        }
        const memoSet = state.memos[row][col];
        if (memoSet.has(num)) {
            memoSet.delete(num);
        } else {
            memoSet.add(num);
        }
    } else {
        state.board[row][col] = num;
        state.memos[row][col].clear();
        state.errors.delete(`${row},${col}`);

        if (isBoardFull()) {
            if (checkSolution()) {
                onPuzzleComplete();
                return;
            }
        }
    }

    saveProgress();
    renderBoard();
}

// ===== 검사 =====
function checkBoard() {
    state.errors = new Set();
    let hasError = false;

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (!state.given[r][c] && state.board[r][c] !== 0) {
                if (state.board[r][c] !== state.solution[r][c]) {
                    state.errors.add(`${r},${c}`);
                    hasError = true;
                }
            }
        }
    }

    renderBoard();

    if (!hasError && !isBoardFull()) {
        showTemporaryMessage("현재까지 맞게 입력했습니다!");
    } else if (!hasError && isBoardFull()) {
        onPuzzleComplete();
    }
}

function showTemporaryMessage(msg) {
    const modal = document.getElementById("complete-modal");
    const content = modal.querySelector(".modal-content");
    const originalH2 = content.querySelector("h2").textContent;
    const originalP = content.querySelector("p").textContent;
    const buttons = modal.querySelector(".modal-buttons");

    content.querySelector("h2").textContent = "";
    content.querySelector("p").textContent = msg;
    buttons.style.display = "none";
    modal.classList.add("active");

    setTimeout(() => {
        modal.classList.remove("active");
        content.querySelector("h2").textContent = originalH2;
        content.querySelector("p").textContent = originalP;
        buttons.style.display = "";
    }, 1500);
}

// ===== 힌트 =====
function useHint() {
    if (state.hints <= 0 || !state.selectedCell) return;
    const { row, col } = state.selectedCell;
    if (state.given[row][col]) return;
    if (state.board[row][col] === state.solution[row][col]) return;

    state.board[row][col] = state.solution[row][col];
    state.memos[row][col].clear();
    state.errors.delete(`${row},${col}`);
    state.hints--;
    document.getElementById("hint-count").textContent = state.hints;

    state.given[row][col] = true;

    saveProgress();
    renderBoard();

    if (isBoardFull() && checkSolution()) {
        onPuzzleComplete();
    }
}

// ===== 완료 체크 =====
function isBoardFull() {
    return state.board.every(row => row.every(cell => cell !== 0));
}

function checkSolution() {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (state.board[r][c] !== state.solution[r][c]) return false;
        }
    }
    return true;
}

function onPuzzleComplete() {
    stopTimer();
    markCompleted(state.currentDifficulty, state.currentPuzzleIndex);

    const min = Math.floor(state.timerSeconds / 60);
    const sec = state.timerSeconds % 60;
    document.getElementById("complete-time").textContent =
        `클리어 시간: ${min}분 ${sec}초`;

    const modal = document.getElementById("complete-modal");
    modal.querySelector("h2").textContent = "축하합니다!";
    modal.querySelector(".modal-buttons").style.display = "";
    modal.classList.add("active");

    const nextIndex = state.currentPuzzleIndex + 1;
    const nextBtn = document.getElementById("btn-next-puzzle");
    if (nextIndex < PUZZLES[state.currentDifficulty].length) {
        nextBtn.style.display = "";
        nextBtn.textContent = `다음 퍼즐 (#${nextIndex + 1})`;
    } else {
        nextBtn.style.display = "none";
    }
}

// ===== 메모 모드 토글 =====
function updateMemoButton() {
    const btn = document.getElementById("btn-memo");
    btn.classList.toggle("active", state.memoMode);
}

// ===== 인증 UI =====
let isRegisterMode = false;

function setupAuthUI() {
    const form = document.getElementById("auth-form");
    const switchBtn = document.getElementById("auth-switch");
    const guestBtn = document.getElementById("guest-login");
    const errorEl = document.getElementById("auth-error");

    switchBtn.addEventListener("click", () => {
        isRegisterMode = !isRegisterMode;
        document.getElementById("auth-subtitle").textContent = isRegisterMode ? "회원가입" : "로그인";
        document.getElementById("auth-submit").textContent = isRegisterMode ? "회원가입" : "로그인";
        document.getElementById("auth-toggle").innerHTML = isRegisterMode
            ? '이미 계정이 있으신가요? <a id="auth-switch">로그인</a>'
            : '계정이 없으신가요? <a id="auth-switch">회원가입</a>';
        document.getElementById("auth-switch").addEventListener("click", arguments.callee);
        errorEl.textContent = "";
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        errorEl.textContent = "";
        const username = document.getElementById("auth-username").value.trim();
        const password = document.getElementById("auth-password").value;

        if (!username || !password) {
            errorEl.textContent = "아이디와 비밀번호를 입력하세요";
            return;
        }

        try {
            const endpoint = isRegisterMode ? "/register" : "/login";
            const data = await api("POST", endpoint, { username, password });
            auth.token = data.token;
            auth.username = data.username;
            auth.isGuest = false;
            localStorage.setItem("sudoku-auth-token", data.token);
            localStorage.setItem("sudoku-auth-username", data.username);
            await enterApp();
        } catch (err) {
            errorEl.textContent = err.message;
        }
    });

    guestBtn.addEventListener("click", async () => {
        auth.token = null;
        auth.username = "게스트";
        auth.isGuest = true;
        localStorage.removeItem("sudoku-auth-token");
        localStorage.removeItem("sudoku-auth-username");
        await enterApp();
    });
}

async function enterApp() {
    document.getElementById("display-username").textContent = auth.username;
    await loadAllData();
    updateHomeProgress();
    showScreen("home-screen");
}

async function tryAutoLogin() {
    const token = localStorage.getItem("sudoku-auth-token");
    const username = localStorage.getItem("sudoku-auth-username");
    if (token && username) {
        auth.token = token;
        auth.username = username;
        auth.isGuest = false;
        try {
            await api("GET", "/me");
            await enterApp();
            return;
        } catch {
            localStorage.removeItem("sudoku-auth-token");
            localStorage.removeItem("sudoku-auth-username");
            auth.token = null;
            auth.username = null;
        }
    }
    showScreen("auth-screen");
}

// ===== 키보드 입력 =====
document.addEventListener("keydown", (e) => {
    if (!document.getElementById("game-screen").classList.contains("active")) return;

    if (e.key === "Escape") {
        if (state.isPaused) resumeGame();
        else pauseGame();
        return;
    }
    if (e.key >= "1" && e.key <= "9") {
        inputNumber(parseInt(e.key, 10));
    } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        inputNumber(0);
    } else if (e.key === "ArrowUp" && state.selectedCell) {
        state.selectedCell.row = Math.max(0, state.selectedCell.row - 1);
        renderBoard();
    } else if (e.key === "ArrowDown" && state.selectedCell) {
        state.selectedCell.row = Math.min(8, state.selectedCell.row + 1);
        renderBoard();
    } else if (e.key === "ArrowLeft" && state.selectedCell) {
        state.selectedCell.col = Math.max(0, state.selectedCell.col - 1);
        renderBoard();
    } else if (e.key === "ArrowRight" && state.selectedCell) {
        state.selectedCell.col = Math.min(8, state.selectedCell.col + 1);
        renderBoard();
    } else if (e.key === "m" || e.key === "M") {
        state.memoMode = !state.memoMode;
        updateMemoButton();
    }
});

// ===== 이벤트 바인딩 =====
document.addEventListener("DOMContentLoaded", () => {
    setupAuthUI();

    // 난이도 카드 클릭
    document.querySelectorAll(".difficulty-card").forEach(card => {
        card.addEventListener("click", () => {
            showPuzzleSelect(card.dataset.difficulty);
        });
    });

    // 뒤로 버튼
    document.getElementById("back-to-home").addEventListener("click", () => {
        updateHomeProgress();
        showScreen("home-screen");
    });

    document.getElementById("back-to-puzzles").addEventListener("click", () => {
        stopTimer();
        saveProgress();
        showPuzzleSelect(state.currentDifficulty);
    });

    // 숫자 패드
    document.querySelectorAll(".num-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            inputNumber(parseInt(btn.dataset.num, 10));
        });
    });

    // 메모 버튼
    document.getElementById("btn-memo").addEventListener("click", () => {
        state.memoMode = !state.memoMode;
        updateMemoButton();
    });

    // 힌트 버튼
    document.getElementById("btn-hint").addEventListener("click", useHint);

    // 검사 버튼
    document.getElementById("btn-check").addEventListener("click", checkBoard);

    // 일시정지 버튼
    document.getElementById("btn-pause").addEventListener("click", pauseGame);
    document.getElementById("btn-resume").addEventListener("click", resumeGame);

    // 모달 버튼
    document.getElementById("btn-next-puzzle").addEventListener("click", () => {
        document.getElementById("complete-modal").classList.remove("active");
        const nextIndex = state.currentPuzzleIndex + 1;
        if (nextIndex < PUZZLES[state.currentDifficulty].length) {
            startGame(state.currentDifficulty, nextIndex);
        }
    });

    document.getElementById("btn-go-home").addEventListener("click", () => {
        document.getElementById("complete-modal").classList.remove("active");
        stopTimer();
        updateHomeProgress();
        showScreen("home-screen");
    });

    // 로그아웃
    document.getElementById("btn-logout").addEventListener("click", async () => {
        if (!auth.isGuest) {
            try { await api("POST", "/logout"); } catch {}
        }
        auth.token = null;
        auth.username = null;
        auth.isGuest = false;
        localStorage.removeItem("sudoku-auth-token");
        localStorage.removeItem("sudoku-auth-username");
        cachedProgress = {};
        cachedCompleted = {};
        showScreen("auth-screen");
    });

    // 자동 로그인 시도
    tryAutoLogin();
});
