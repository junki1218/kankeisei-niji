const fs = require('fs');

try {
    let code = fs.readFileSync('script.js', 'utf8');
    const startMarker = '// Service Workerのキャッシュ等で古いindex.htmlやCSSが残っている場合へ対処するため';
    const endMarker = "            clearMessage.classList.remove('hidden');";

    const startIndex = code.indexOf(startMarker);
    const endIndex = code.indexOf(endMarker);

    if (startIndex !== -1 && endIndex !== -1) {
        const repairedCode = `// Service Workerのキャッシュ等で古いindex.htmlやCSSが残っている場合へ対処するため
            // headタグに直接styleタグを注入して強制的に上書きします。
            const style = document.createElement('style');
            style.textContent = \`
                #clear-message {
                    position: absolute !important;
                    bottom: 5% !important;
                    top: auto !important;
                    left: 50% !important;
                    transform: translateX(-50%) !important;
                    width: 90% !important;
                    max-width: 400px !important;
                }
            \`;
            document.head.appendChild(style);

            // innerHTMLをまるごと書き換えて、強力なキャッシュや古いHTML構造を完全に無視する
            clearMessage.innerHTML = \`
                <button id="close-clear-message-btn" style="position: absolute; top: 10px; right: 15px; background: none; border: none; font-size: 2rem; font-weight: bold; cursor: pointer; color: #94a3b8; padding: 0;">×</button>
                <h2 class="hiragana text-xl highlight" style="margin-top: 15px; margin-bottom: 20px;">🌈 にじが できたね！</h2>
                <h2 class="kanji text-xl highlight" style="margin-top: 15px; margin-bottom: 20px;">🌈 虹が できました！</h2>
                <p style="margin-bottom: 25px; color: var(--text-primary); font-weight: 500; font-size: 1.1rem; line-height: 1.6;">
                    <span class="hiragana">※ このがめんを<br>スクリーンショットしてね！</span>
                    <span class="kanji">※ この画面を<br>スクリーンショットしてね！</span>
                </p>
            \`;

            // 追加した要素のイベントリスナーを登録
            document.getElementById('close-clear-message-btn').addEventListener('click', () => {
                clearMessage.classList.add('hidden');
            });
`;

        const finalCode = code.substring(0, startIndex) + repairedCode + "\n" + code.substring(endIndex);
        fs.writeFileSync('script.js', finalCode);
        console.log("Successfully Repaired script.js");
    } else {
        console.log("Error: markers not found.");
        console.log("startIndex: ", startIndex);
        console.log("endIndex: ", endIndex);
    }
} catch (e) {
    console.error(e);
}
