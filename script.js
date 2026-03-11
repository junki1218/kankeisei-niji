document.addEventListener('DOMContentLoaded', () => {
    // 状態管理
    let textMode = 'hiragana';
    let uploadedImages = [];
    let currentCardIndex = 0;

    // クイズ用状態
    let quizQueue = [];
    let currentQuizIndex = 0;

    // ドラッグ＆ドロップ用
    let isDragging = false;
    let draggedElement = null;
    let offsetX = 0, offsetY = 0;

    // 配置済みカードより新しく出るカードを上にするためのZ-indexカウンター
    let highestZIndex = 500;

    // Web Audio API
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    let audioCtx = new AudioContext();

    // BGM要素
    const bgmOp = document.getElementById('bgm-op');
    const bgmGame = document.getElementById('bgm-game');

    // BGMの音量を少し下げる（効果音が聞こえやすくするため）
    bgmOp.volume = 0.3;
    bgmGame.volume = 0.3;

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        if (type === 'correct') { // ピンポン
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
            osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.1); // C6
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
            osc.start(); osc.stop(audioCtx.currentTime + 0.4);
        } else if (type === 'wrong') { // ブーブー
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(150, audioCtx.currentTime);
            osc.frequency.setValueAtTime(140, audioCtx.currentTime + 0.2);
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
            osc.start(); osc.stop(audioCtx.currentTime + 0.4);
        }
    }

    // 要素取得
    const body = document.body;

    // 画面類
    const opScreen = document.getElementById('op-screen');
    const settingsScreen = document.getElementById('settings-screen');
    const gameScreen = document.getElementById('game-screen');
    const quizScreen = document.getElementById('quiz-screen');

    // UI部品
    const modeRadios = document.querySelectorAll('input[name="text-mode"]');
    const imageUpload = document.getElementById('image-upload');
    const imageList = document.getElementById('image-list');
    const opStartBtn = document.getElementById('op-start-btn');
    const startBtn = document.getElementById('start-btn');
    const resetBtn = document.getElementById('reset-btn');
    const gameContainer = document.getElementById('game-container');
    const playArea = document.getElementById('play-area');
    const cardIntroOverlay = document.getElementById('card-intro-overlay');
    const introCardImg = document.getElementById('intro-card-img');
    const introCardName = document.getElementById('intro-card-name');
    const feedbackOverlay = document.getElementById('feedback-overlay');
    const nextBtn = document.getElementById('next-btn');
    const clearMessage = document.getElementById('clear-message');
    const toQuizBtn = document.getElementById('to-quiz-btn');
    const addItemBtn = document.getElementById('add-item-btn');

    // クイズ部品
    const quizPersonImg = document.getElementById('quiz-person-img');
    const quizActionIcon = document.getElementById('quiz-action-icon');
    const quizActionName = document.getElementById('quiz-action-name');
    const quizGoBtn = document.getElementById('quiz-go-btn');
    const quizNoBtn = document.getElementById('quiz-no-btn');
    const quizClearMessage = document.getElementById('quiz-clear-message');
    const returnOpBtn = document.getElementById('return-op-btn');

    // 属性定義
    const attributes = [
        { value: 'purple', hiragana: 'わたし', kanji: 'わたし' },
        { value: 'blue', hiragana: 'かぞく', kanji: '家族' },
        { value: 'green', hiragana: 'ともだち', kanji: '友達' },
        { value: 'yellow', hiragana: 'まいにちあうひと', kanji: '毎日会う人' },
        { value: 'orange', hiragana: 'なまえをしっている', kanji: '名前を知っている' },
        { value: 'red', hiragana: 'しらないひと', kanji: '知らない人' }
    ];

    // クイズのアクション定義
    const touchActions = [
        { id: 'greet', icon: '👋', hiragana: 'あいさつ', kanji: '挨拶（あいさつ）' },
        { id: 'talk', icon: '🗣️', hiragana: 'かいわ', kanji: '会話' },
        { id: 'highfive', icon: '🙌', hiragana: 'ハイタッチ', kanji: 'ハイタッチ' },
        { id: 'handshake', icon: '🤝', hiragana: 'あくしゅ', kanji: '握手' },
        { id: 'hug', icon: '🫂', hiragana: 'ハグ', kanji: 'ハグ' },
        { id: 'private', icon: '🫣', hiragana: 'プライベートゾーンにふれる・みる', kanji: 'プライベートゾーンに触れる/見る' }
    ];

    // クイズ正解判定ロジック (true = GO正解, false = NO正解)
    // CAPプログラムベースの距離感
    const quizRules = {
        'greet': { 'purple': true, 'blue': true, 'green': true, 'yellow': true, 'orange': true, 'red': true },
        'talk': { 'purple': true, 'blue': true, 'green': true, 'yellow': true, 'orange': true, 'red': false },
        'highfive': { 'purple': true, 'blue': true, 'green': true, 'yellow': true, 'orange': false, 'red': false },
        'handshake': { 'purple': true, 'blue': true, 'green': true, 'yellow': false, 'orange': false, 'red': false },
        'hug': { 'purple': true, 'blue': true, 'green': false, 'yellow': false, 'orange': false, 'red': false },
        'private': { 'purple': true, 'blue': false, 'green': false, 'yellow': false, 'orange': false, 'red': false }
    };

    function init() {
        body.className = `mode-${textMode}`;
        loadFromLocalStorage();
        updateUI();

        opStartBtn.addEventListener('click', () => switchScreen(settingsScreen));

        modeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                textMode = e.target.value;
                body.className = `mode-${textMode}`;
                renderImageList();
                if (quizScreen.classList.contains('active')) updateQuizUI();
            });
        });

        imageUpload.addEventListener('change', handleImageUpload);
        resetBtn.addEventListener('click', resetData);
        startBtn.addEventListener('click', startGame);
        nextBtn.addEventListener('click', nextTurn);
        toQuizBtn.addEventListener('click', startQuiz);
        addItemBtn.addEventListener('click', handleAddItem);
        quizGoBtn.addEventListener('click', () => handleQuizAnswer(true));
        quizNoBtn.addEventListener('click', () => handleQuizAnswer(false));
        returnOpBtn.addEventListener('click', () => location.reload()); // 初期状態に安全に戻す
    }

    function switchScreen(targetScreen) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        targetScreen.classList.add('active');
        if (audioCtx.state === 'suspended') audioCtx.resume();

        // BGM切り替えロジック
        if (targetScreen === opScreen || targetScreen === settingsScreen) {
            bgmGame.pause();
            bgmGame.currentTime = 0;
            // ユーザーインタラクション前はエラーになるためcatchする
            bgmOp.play().catch(e => console.log('BGM Autoplay prevented'));
        } else if (targetScreen === gameScreen || targetScreen === quizScreen) {
            bgmOp.pause();
            bgmOp.currentTime = 0;
            bgmGame.play().catch(e => console.log('BGM Autoplay prevented'));
        }
    }

    // --- 画像・設定関連 ---
    function resizeImage(file, maxSize = 400) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width, height = img.height;
                    if (width > height) {
                        if (width > maxSize) { height *= maxSize / width; width = maxSize; }
                    } else {
                        if (height > maxSize) { width *= maxSize / height; height = maxSize; }
                    }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = reject; img.src = e.target.result;
            };
            reader.onerror = reject; reader.readAsDataURL(file);
        });
    }

    async function handleImageUpload(e) {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const toProcess = files.slice(0, 10 - uploadedImages.length);

        const uploadTextOrig = document.querySelector('.upload-btn .hiragana').textContent;
        document.querySelector('.upload-btn').style.opacity = '0.5';

        for (const file of toProcess) {
            try {
                const dataUrl = await resizeImage(file);
                uploadedImages.push({
                    id: 'img_' + Date.now() + Math.random().toString(36).substr(2, 5),
                    dataUrl: dataUrl,
                    targetColor: 'purple',
                    name: ''
                });
            } catch (err) { console.error('Image Error:', err); }
        }

        document.querySelector('.upload-btn').style.opacity = '1';
        saveToLocalStorage();
        updateUI();
        imageUpload.value = '';
    }

    function renderImageList() {
        imageList.innerHTML = '';
        uploadedImages.forEach((imgData, index) => {
            const item = document.createElement('div');
            item.className = 'image-item';

            // 削除ボタン
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-item-btn';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = textMode === 'hiragana' ? 'けす' : '消す';
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                uploadedImages.splice(index, 1);
                saveToLocalStorage();
                updateUI();
            });

            // 個別画像変更用のinput
            const singleFileInput = document.createElement('input');
            singleFileInput.type = 'file';
            singleFileInput.accept = 'image/*';
            singleFileInput.style.display = 'none';
            singleFileInput.addEventListener('change', async (e) => {
                if (e.target.files.length > 0) {
                    try {
                        const newUrl = await resizeImage(e.target.files[0]);
                        uploadedImages[index].dataUrl = newUrl;
                        saveToLocalStorage();
                        updateUI();
                    } catch (err) { console.error('Image Error:', err); }
                }
            });

            const img = document.createElement('img');
            img.src = imgData.dataUrl;
            img.title = textMode === 'hiragana' ? 'タップしてしゃしんをかえる' : 'タップして写真を変更';
            img.addEventListener('click', () => {
                singleFileInput.click();
            });

            const select = document.createElement('select');
            attributes.forEach(attr => {
                const option = document.createElement('option');
                option.value = attr.value;
                option.textContent = textMode === 'hiragana' ? attr.hiragana : attr.kanji;
                if (imgData.targetColor === attr.value) option.selected = true;
                select.appendChild(option);
            });

            select.addEventListener('change', (e) => {
                uploadedImages[index].targetColor = e.target.value;
                saveToLocalStorage();
            });

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.placeholder = textMode === 'hiragana' ? 'なまえ（じゆう）' : '名前（自由）';
            nameInput.value = imgData.name || '';
            nameInput.maxLength = 10;
            nameInput.addEventListener('change', (e) => {
                uploadedImages[index].name = e.target.value;
                saveToLocalStorage();
            });

            item.appendChild(deleteBtn);
            item.appendChild(singleFileInput);
            item.appendChild(img);
            item.appendChild(nameInput);
            item.appendChild(select);
            imageList.appendChild(item);
        });
    }

    function handleAddItem() {
        if (uploadedImages.length >= 20) {
            alert(textMode === 'hiragana' ? 'これいじょう つイカできません' : 'これ以上追加できません');
            return;
        }
        uploadedImages.push({
            id: 'img_' + Date.now() + Math.random().toString(36).substr(2, 5),
            dataUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', // 透明プレースホルダー
            targetColor: 'purple',
            name: ''
        });
        saveToLocalStorage();
        updateUI();
    }

    function updateUI() {
        renderImageList();
        startBtn.disabled = uploadedImages.length === 0;
    }

    function saveToLocalStorage() { localStorage.setItem('sd_images_v2', JSON.stringify(uploadedImages)); }
    function loadFromLocalStorage() {
        const data = localStorage.getItem('sd_images_v2');
        if (data) {
            uploadedImages = JSON.parse(data);
        }

        // もし空ならデフォルトの6枠を用意する
        if (uploadedImages.length === 0) {
            const defaultColors = ['purple', 'blue', 'green', 'yellow', 'orange', 'red'];
            const transparentImg = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
            uploadedImages = defaultColors.map(color => ({
                id: 'img_' + Date.now() + Math.random().toString(36).substr(2, 5),
                dataUrl: transparentImg,
                targetColor: color,
                name: ''
            }));
            saveToLocalStorage();
        }
    }
    function resetData() {
        if (confirm(textMode === 'hiragana' ? 'けしますか？' : 'リセットしますか？')) {
            uploadedImages = []; localStorage.removeItem('sd_images_v2'); updateUI();
        }
    }

    // --- メインゲームロジック (Drag & Drop バグ修正版) ---
    function startGame() {
        if (uploadedImages.length === 0) return;

        // Randomize
        uploadedImages.sort(() => Math.random() - 0.5);

        switchScreen(gameScreen);
        currentCardIndex = 0;
        playArea.innerHTML = ''; clearMessage.classList.add('hidden'); nextBtn.classList.add('hidden');
        showCardIntro();
    }

    function showCardIntro() {
        if (currentCardIndex >= uploadedImages.length) {
            // Service Workerのキャッシュ等で古いindex.htmlやCSSが残っている場合へ対処するため
            // headタグに直接styleタグを注入して強制的に上書きします。
            const style = document.createElement('style');
            style.textContent = `
                #clear-message {
                    position: absolute !important;
                    bottom: 5% !important;
                    top: auto !important;
                    left: 50% !important;
                    transform: translateX(-50%) !important;
                    width: 90% !important;
                    max-width: 400px !important;
                }
            `;
            document.head.appendChild(style);

            // innerHTMLをまるごと書き換えて、強力なキャッシュや古いHTML構造を完全に無視する
            clearMessage.innerHTML = `
                <button id="close-clear-message-btn" style="position: absolute; top: 10px; right: 15px; background: none; border: none; font-size: 2rem; font-weight: bold; cursor: pointer; color: #94a3b8; padding: 0;">×</button>
                <h2 class="hiragana text-xl highlight" style="margin-top: 15px; margin-bottom: 20px;">🌈 にじが できたね！</h2>
                <h2 class="kanji text-xl highlight" style="margin-top: 15px; margin-bottom: 20px;">🌈 虹が できました！</h2>
                <p style="margin-bottom: 25px; color: var(--text-primary); font-weight: 500; font-size: 1.1rem; line-height: 1.6;">
                    <span class="hiragana">※ このがめんを<br>スクリーンショットしてね！<br><br>↓ おわったら クイズに ちょうせん！</span>
                    <span class="kanji">※ この画面を<br>スクリーンショットしてね！<br><br>↓ 終わったら、ふれあいクイズに挑戦！</span>
                </p>
                <div class="flex-center">
                    <button id="dynamic-to-quiz-btn" class="primary-btn bounce-animation" style="width: 100%; border: none;">
                        <span class="hiragana">ふれあいクイズへ ▸</span>
                        <span class="kanji">ふれあいクイズへ ▸</span>
                    </button>
                </div>
            `;

            // 追加した要素のイベントリスナーを登録
            document.getElementById('close-clear-message-btn').addEventListener('click', () => {
                clearMessage.classList.add('hidden');
            });
            document.getElementById('dynamic-to-quiz-btn').addEventListener('click', startQuiz);

            clearMessage.classList.remove('hidden');
            return;
        }
        const data = uploadedImages[currentCardIndex];
        introCardImg.src = data.dataUrl;

        if (data.name) {
            introCardName.textContent = data.name;
            introCardName.classList.remove('hidden');
        } else {
            introCardName.classList.add('hidden');
        }

        cardIntroOverlay.classList.remove('hidden');
        void cardIntroOverlay.offsetWidth; // Reflow
        cardIntroOverlay.classList.add('show-intro');

        setTimeout(() => {
            cardIntroOverlay.classList.remove('show-intro');
            setTimeout(() => {
                cardIntroOverlay.classList.add('hidden');
                spawnDraggableCard(data);
            }, 400);
        }, 1500);
    }

    function spawnDraggableCard(data) {
        // コンテナ作成
        const container = document.createElement('div');
        container.className = 'draggable-card-container';
        container.dataset.color = data.targetColor;

        // Z-indexを更新して一番上に出現させる
        highestZIndex++;
        container.style.zIndex = highestZIndex;

        const card = document.createElement('img');
        card.src = data.dataUrl;
        card.className = 'draggable-card';

        container.appendChild(card);

        if (data.name) {
            const nameTag = document.createElement('div');
            nameTag.className = 'card-name-tag';
            // 最初の6文字まで表示、超える場合は「...」をつけるような見せ方
            const shortName = data.name.length > 6 ? data.name.substring(0, 6) + '…' : data.name;
            nameTag.textContent = shortName;
            // データ属性にフルネームを持たせておく（拡大時に使う）
            nameTag.dataset.fullname = data.name;
            container.appendChild(nameTag);
        }

        // 右下の端に配置
        container.style.left = `90%`;
        container.style.top = `90%`;
        container.style.transform = ''; // CSSに任せる

        playArea.appendChild(container);

        container.addEventListener('mousedown', dragStart);
        container.addEventListener('touchstart', dragStart, { passive: false });
    }

    // タップされた位置と時間を記録して、クリック（タップ）判定にする
    let lastTouchDown = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;

    function dragStart(e) {
        const isTouch = e.type === 'touchstart';
        const startX = isTouch ? e.touches[0].clientX : e.clientX;
        const startY = isTouch ? e.touches[0].clientY : e.clientY;

        const targetEl = e.currentTarget; // container

        if (targetEl.classList.contains('fixed')) {
            // 固定済ならタップで拡大/縮小
            handleTap(targetEl);
            return;
        }

        lastTouchDown = Date.now();
        lastTouchX = startX;
        lastTouchY = startY;

        isDragging = true;
        draggedElement = targetEl;
        draggedElement.classList.add('dragging');

        // 最初のタッチ位置
        const currentEventX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const currentEventY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

        // 要素の現在の見た目の位置を取得
        const rect = draggedElement.getBoundingClientRect();
        const containerRect = gameContainer.getBoundingClientRect();

        // 要素の中心座標を計算
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // クリック位置と中心点のズレを保持
        offsetX = currentEventX - centerX;
        offsetY = currentEventY - centerY;

        // JS側でのtransform上書きを解除し、CSSに任せる
        draggedElement.style.transform = '';

        // 初期位置をpxで明示的にセット（中心座標基準）
        let newLeft = centerX - containerRect.left;
        let newTop = centerY - containerRect.top;
        draggedElement.style.left = `${newLeft}px`;
        draggedElement.style.top = `${newTop}px`;

        document.addEventListener('mousemove', drag);
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('touchend', dragEnd);

        if (e.type !== 'touchstart') e.preventDefault();
    }

    function drag(e) {
        if (!isDragging) return;
        e.preventDefault();

        const currentX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const currentY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        const containerRect = gameContainer.getBoundingClientRect();

        // 新しい中心座標を計算
        let newCenterX = currentX - offsetX - containerRect.left;
        let newCenterY = currentY - offsetY - containerRect.top;

        // center座標をleft/topに適用する（CSSの translate(-50%,-50%) が効くためこれで合致する）
        draggedElement.style.left = `${newCenterX}px`;
        draggedElement.style.top = `${newCenterY}px`;
    }

    function handleTap(targetEl) {
        if (targetEl.classList.contains('enlarged')) {
            // 縮小
            targetEl.classList.remove('enlarged');
            targetEl.style.zIndex = targetEl.dataset.originalZIndex || 500; // 元のZindexに戻す
            const nameTag = targetEl.querySelector('.card-name-tag');
            if (nameTag) {
                const name = nameTag.dataset.fullname || '';
                nameTag.textContent = name.length > 6 ? name.substring(0, 6) + '…' : name;
            }
        } else {
            // 拡大
            // 他が開いていれば閉じる
            document.querySelectorAll('.draggable-card-container.enlarged').forEach(el => {
                el.classList.remove('enlarged');
                el.style.zIndex = el.dataset.originalZIndex || 500;
                const tag = el.querySelector('.card-name-tag');
                if (tag) {
                    const name = tag.dataset.fullname || '';
                    tag.textContent = name.length > 6 ? name.substring(0, 6) + '…' : name;
                }
            });
            // 自身を最前面へ
            targetEl.dataset.originalZIndex = targetEl.style.zIndex;
            highestZIndex++;
            targetEl.style.zIndex = highestZIndex;

            targetEl.classList.add('enlarged');
            const nameTag = targetEl.querySelector('.card-name-tag');
            if (nameTag) nameTag.textContent = nameTag.dataset.fullname; // フルネーム表示
        }
    }

    function dragEnd(e) {
        if (!isDragging) return;

        // わずかな移動＆短時間ならクリック（タップ）として扱う
        const isTouch = e.type === 'touchend';
        const endX = isTouch ? (e.changedTouches ? e.changedTouches[0].clientX : lastTouchX) : e.clientX;
        const endY = isTouch ? (e.changedTouches ? e.changedTouches[0].clientY : lastTouchY) : e.clientY;
        const dist = Math.hypot(endX - lastTouchX, endY - lastTouchY);
        const timeElapsed = Date.now() - lastTouchDown;

        isDragging = false;
        draggedElement.classList.remove('dragging');

        document.removeEventListener('mousemove', drag);
        document.removeEventListener('touchmove', drag);
        document.removeEventListener('mouseup', dragEnd);
        document.removeEventListener('touchend', dragEnd);

        if (dist < 10 && timeElapsed < 300) {
            // ただのクリックとして扱い、ドロップ判定はしない
            // ドロップ前に拡大したい場合など
            draggedElement = null;
            return;
        }

        checkDrop();
    }

    function checkDrop() {
        const rect = draggedElement.getBoundingClientRect();
        const containerRect = gameContainer.getBoundingClientRect();

        // 要素の中心のコンテナ内での相対Y座標を取得
        const centerY = rect.top + rect.height / 2;
        const relativeY = centerY - containerRect.top;

        // コンテナの高さに対する割合 (0.0=上端 〜 1.0=下端)
        let yRatio = relativeY / containerRect.height;
        if (yRatio < 0) yRatio = 0;
        if (yRatio > 1) yRatio = 1;

        // 横方向もコンテナ幅での割合を取得 (0.0=左端 〜 1.0=右端)
        const centerX = rect.left + rect.width / 2;
        const relativeX = centerX - containerRect.left;
        let xRatio = relativeX / containerRect.width;
        if (xRatio < 0) xRatio = 0;
        if (xRatio > 1) xRatio = 1;

        // 縦方向を6分割し、下から順に判定
        let droppedColor = '';
        if (yRatio >= (5 / 6)) {
            // わたし (下部) は横方向も一番左、一番右を不正解にする
            if (xRatio < 0.2 || xRatio > 0.8) {
                droppedColor = 'none_invalid_purple'; // 不正解にするためのダミー
            } else {
                droppedColor = 'purple';
            }
        } else if (yRatio >= (4 / 6)) {
            droppedColor = 'blue';    // 家族
        } else if (yRatio >= (3 / 6)) {
            droppedColor = 'green';   // 友達
        } else if (yRatio >= (2 / 6)) {
            droppedColor = 'yellow';  // 毎日会う人
        } else if (yRatio >= (1 / 6)) {
            droppedColor = 'orange';  // 名前を知っている人
        } else {
            droppedColor = 'red';     // 知らない人 (上部)
        }

        if (droppedColor === draggedElement.dataset.color) {
            handleCorrect();
        } else {
            handleWrong();
        }
    }

    function handleCorrect() {
        playSound('correct');
        showFeedback('⭕️', 'var(--success-color)');

        draggedElement.removeEventListener('mousedown', dragStart);
        draggedElement.removeEventListener('touchstart', dragStart);
        draggedElement.classList.add('fixed');

        const containerRect = gameContainer.getBoundingClientRect();

        // -------------------------------------------------------------
        // 要素をDOM上で「移動」したりクラスを付け替えた際の再計算ズレを防ぐため、
        // 「今ドラッグで配置されていたピクセル位置」をそのまま100%の割合に変換します。
        // （CSSの translate(-50%, -50%) によって、指定座標＝中心 となるためこれが一番正確です）
        // -------------------------------------------------------------
        const currentPxX = parseFloat(draggedElement.style.left);
        const currentPxY = parseFloat(draggedElement.style.top);

        const leftPerc = (currentPxX / containerRect.width) * 100;
        const topPerc = (currentPxY / containerRect.height) * 100;

        // left/top は要素の左上の位置を指定しますが、
        // .draggable-card-container にはCSSで transform: translate(-50%, -50%) が
        // かかっている（またはドラッグ中と同等の中心起点の動きをする）ため、
        // そのまま中心の割合を left/top に入れることで位置が維持されます。
        draggedElement.style.left = `${leftPerc}%`;
        draggedElement.style.top = `${topPerc}%`;

        // CSS側の transform: translate(-50%, -50%)（及び固定時の scale）を効かせるため、
        // JSで直接割り当てていた transform（もしあれば）をクリアします。
        draggedElement.style.transform = '';

        // Z-indexを固定して新しく来るカードより下にするが、既存のカードとの前後関係は維持
        draggedElement.dataset.originalZIndex = draggedElement.style.zIndex;

        // gameContainerの直接の子にして固定
        gameContainer.appendChild(draggedElement);
        draggedElement = null;
        nextBtn.classList.remove('hidden');
    }

    function handleWrong() {
        playSound('wrong');
        showFeedback('❌', 'var(--danger-color)');

        // 右下に戻す
        draggedElement.style.transition = 'all 0.3s ease';
        draggedElement.style.left = `90%`;
        draggedElement.style.top = `90%`;
        draggedElement.style.transform = '';

        setTimeout(() => { draggedElement.style.transition = ''; draggedElement = null; }, 300);
    }

    function showFeedback(text, color) {
        feedbackOverlay.textContent = text; feedbackOverlay.style.color = color;
        feedbackOverlay.classList.remove('hidden', 'show-feedback');
        void feedbackOverlay.offsetWidth;
        feedbackOverlay.classList.add('show-feedback');
    }

    function nextTurn() {
        nextBtn.classList.add('hidden'); currentCardIndex++; showCardIntro();
    }

    // --- ふれあいクイズ（タッチクイズ）ロジック ---
    function startQuiz() {
        switchScreen(quizScreen);

        // 問題リストを生成
        quizQueue = [];
        uploadedImages.forEach(imgData => {
            if (imgData.targetColor === 'purple') {
                // 自分（紫）の場合は F (private) だけを出題する
                const action = touchActions.find(a => a.id === 'private');
                quizQueue.push({
                    imgData: imgData,
                    action: action,
                    isAllowed: quizRules[action.id][imgData.targetColor]
                });
            } else {
                touchActions.forEach(action => {
                    // 自分（紫）以外はすべてのアクションを出題する（Fも出題されるが正解はNO）
                    quizQueue.push({
                        imgData: imgData,
                        action: action,
                        isAllowed: quizRules[action.id][imgData.targetColor]
                    });
                });
            }
        });

        // 配列をシャッフル
        quizQueue.sort(() => Math.random() - 0.5);
        // 問題数が多すぎると飽きるので、最大10問などに制限する
        if (quizQueue.length > 10) quizQueue = quizQueue.slice(0, 10);

        currentQuizIndex = 0;
        quizClearMessage.classList.add('hidden');
        document.querySelector('.quiz-container').classList.remove('hidden');

        loadQuizQuestion();
    }

    function loadQuizQuestion() {
        if (currentQuizIndex >= quizQueue.length) {
            document.querySelector('.quiz-container').classList.add('hidden');
            quizClearMessage.classList.remove('hidden');
            playSound('correct'); // ファンファーレ的
            return;
        }

        const q = quizQueue[currentQuizIndex];
        quizPersonImg.src = q.imgData.dataUrl;
        quizActionIcon.textContent = q.action.icon;
        updateQuizUI(); // テキストモードに応じて更新
    }

    function updateQuizUI() {
        if (quizQueue.length > 0 && currentQuizIndex < quizQueue.length) {
            const action = quizQueue[currentQuizIndex].action;
            quizActionName.textContent = textMode === 'hiragana' ? action.hiragana : action.kanji;
        }
    }

    function handleQuizAnswer(userAnswer) {
        const q = quizQueue[currentQuizIndex];
        const isCorrect = (userAnswer === q.isAllowed);

        if (isCorrect) {
            playSound('correct');
            // 一瞬緑っぽく光る演出を追加できたら
            const btn = userAnswer ? quizGoBtn : quizNoBtn;
            btn.style.transform = 'scale(1.1)';
            setTimeout(() => btn.style.transform = '', 200);

            currentQuizIndex++;
            setTimeout(loadQuizQuestion, 300); // すぐ次へ
        } else {
            playSound('wrong');
            // ボタンを震わせる演出
            const btnContainer = document.querySelector('.quiz-buttons');
            btnContainer.classList.add('shake');
            setTimeout(() => btnContainer.classList.remove('shake'), 400);
        }
    }

    // Shake Animation用スタイル追加
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-10px); }
            40%, 80% { transform: translateX(10px); }
        }
        .shake { animation: shake 0.4s; }
    `;
    document.head.appendChild(style);

    init();
});
