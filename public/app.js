function openTab(evt, tabName) {
    const tabcontent = document.getElementsByClassName("tab-content");
    const tabbuttons = document.getElementsByClassName("tab-button");

    // 隐藏所有标签内容
    for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].classList.remove("active");
    }

    // 移除所有标签按钮的活动状态
    for (let i = 0; i < tabbuttons.length; i++) {
        tabbuttons[i].classList.remove("active");
    }

    // 显示当前标签内容并设置按钮为活动状态
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
}

// 显示状态消息
function showStatus(message, isError = false) {
    const statusMessage = document.getElementById("status-message");
    statusMessage.textContent = message;
    statusMessage.className = "status-message";
    statusMessage.classList.add(isError ? "error" : "success");
    
    // 5秒后自动隐藏消息
    setTimeout(() => {
        statusMessage.className = "status-message";
    }, 5000);
}

// 读取文件内容
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error("文件读取失败"));
        reader.readAsText(file);
    });
}

// 下载文件
function downloadFile(content, filename, contentType) {
    const a = document.createElement('a');
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

// 加密文件处理
const encryptFileInput = document.getElementById("encrypt-file");
const encryptJsonPreview = document.getElementById("encrypt-json-preview");
const encryptBtn = document.getElementById("encrypt-btn");
const exportEncryptedBtn = document.getElementById("export-encrypted-btn");
const encryptKeyInput = document.getElementById("encrypt-key");

// 存储加密结果和文件名
let encryptedResult = null;
let encryptedFileName = '';

// 预览加密文件内容
encryptFileInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const content = await readFile(file);
        // 验证是否为有效的JSON
        JSON.parse(content);
        encryptJsonPreview.value = content;
        showStatus("文件已加载成功");
    } catch (error) {
        showStatus("请上传有效的JSON文件", true);
        encryptJsonPreview.value = "";
    }
});

// 加密按钮点击事件
encryptBtn.addEventListener("click", async () => {
    const key = encryptKeyInput.value;
    const file = encryptFileInput.files[0];

    if (!key) {
        showStatus("请输入加密密钥", true);
        return;
    }

    if (!file) {
        showStatus("请选择要加密的JSON文件", true);
        return;
    }

    try {
        showStatus("正在加密中...");
        const content = await readFile(file);
        const jsonData = JSON.parse(content);

        // 使用CryptoJS进行加密
        const encrypted = CryptoJS.AES.encrypt(JSON.stringify(jsonData), key).toString();

        // 存储加密结果和文件名
        encryptedResult = encrypted;
        encryptedFileName = file.name.replace('.json', '');
        
        // 启用导出按钮
        exportEncryptedBtn.disabled = false;
        
        showStatus("文件加密成功，请点击导出按钮下载");
    } catch (error) {
        showStatus(`加密失败: ${error.message}`, true);
    }
});

// 解密文件处理
const decryptFileInput = document.getElementById("decrypt-file");
const decryptJsonPreview = document.getElementById("decrypt-json-preview");
const decryptBtn = document.getElementById("decrypt-btn");
const exportDecryptedBtn = document.getElementById("export-decrypted-btn");
const decryptKeyInput = document.getElementById("decrypt-key");

// 存储解密结果和文件名
let decryptedResult = null;
let decryptedFileName = '';

// 预览解密文件内容
// 这里不预览加密内容，因为它是乱码

decryptFileInput.addEventListener("change", () => {
    const file = decryptFileInput.files[0];
    if (file) {
        decryptJsonPreview.value = "文件已选择，点击解密按钮开始解密";
    }
});

// 解密按钮点击事件
decryptBtn.addEventListener("click", async () => {
    const key = decryptKeyInput.value;
    const file = decryptFileInput.files[0];

    if (!key) {
        showStatus("请输入解密密钥", true);
        return;
    }

    if (!file) {
        showStatus("请选择要解密的文件", true);
        return;
    }

    try {
        showStatus("正在解密中...");
        const encryptedContent = await readFile(file);

        // 使用CryptoJS进行解密
        const bytes = CryptoJS.AES.decrypt(encryptedContent, key);
        const decryptedText = bytes.toString(CryptoJS.enc.Utf8);

        if (!decryptedText) {
            showStatus("解密失败: 无效的密钥或数据", true);
            return;
        }

        // 验证解密后的内容是否为有效的JSON
        const decryptedData = JSON.parse(decryptedText);
        
        // 显示解密后的JSON内容
        decryptJsonPreview.value = JSON.stringify(decryptedData, null, 2);
        
        // 存储解密结果和文件名
        decryptedResult = JSON.stringify(decryptedData, null, 2);
        decryptedFileName = file.name.replace(/(_encrypted)?\.(txt|enc)$/, '');
        
        // 启用导出按钮
        exportDecryptedBtn.disabled = false;
        
        showStatus("文件解密成功，请点击导出按钮下载");
    } catch (error) {
        showStatus(`解密失败: ${error.message}`, true);
    }
});

// 加密文件导出按钮点击事件
exportEncryptedBtn.addEventListener("click", () => {
    if (encryptedResult && encryptedFileName) {
        downloadFile(encryptedResult, `${encryptedFileName}_encrypted.txt`, 'text/plain');
        showStatus("加密文件导出成功");
    } else {
        showStatus("没有可导出的加密文件", true);
    }
});

// 解密文件导出按钮点击事件
exportDecryptedBtn.addEventListener("click", () => {
    if (decryptedResult && decryptedFileName) {
        downloadFile(decryptedResult, `${decryptedFileName}_decrypted.json`, 'application/json');
        showStatus("解密文件导出成功");
    } else {
        showStatus("没有可导出的解密文件", true);
    }
});