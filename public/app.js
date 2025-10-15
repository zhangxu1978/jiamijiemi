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
    const jsonPreviewContent = encryptJsonPreview.value;
    const file = encryptFileInput.files[0];

    if (!key) {
        showStatus("请输入加密密钥", true);
        return;
    }

    if (!jsonPreviewContent.trim()) {
        showStatus("请先上传JSON文件或在预览区输入JSON内容", true);
        return;
    }

    try {
        showStatus("正在加密中...");
        // 直接使用预览区编辑后的内容
        const jsonData = JSON.parse(jsonPreviewContent);

        // 使用CryptoJS进行加密
        const encrypted = CryptoJS.AES.encrypt(JSON.stringify(jsonData), key).toString();

        // 存储加密结果和文件名
        encryptedResult = encrypted;
        encryptedFileName = file ? file.name.replace('.json', '') : 'encrypted_data';
        
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
        
        showStatus("文件解密成功，您可以编辑预览区内容后再导出");
    } catch (error) {
        showStatus(`解密失败: ${error.message}`, true);
    }
});

// 加密文件导出按钮点击事件
exportEncryptedBtn.addEventListener("click", () => {
    const key = encryptKeyInput.value;
    const jsonPreviewContent = encryptJsonPreview.value;

    if (!key) {
        showStatus("请输入加密密钥", true);
        return;
    }

    if (!jsonPreviewContent.trim()) {
        showStatus("预览区没有内容可加密导出", true);
        return;
    }

    try {
        // 直接使用预览区编辑后的内容进行加密导出
        const jsonData = JSON.parse(jsonPreviewContent);
        const encrypted = CryptoJS.AES.encrypt(JSON.stringify(jsonData), key).toString();
        downloadFile(encrypted, `${encryptedFileName || 'encrypted_data'}encrypted.txt`, 'text/plain');
        showStatus("加密文件导出成功");
    } catch (error) {
        showStatus(`导出失败: ${error.message}`, true);
    }
});

// 解密文件导出按钮点击事件
exportDecryptedBtn.addEventListener("click", () => {
    if (decryptJsonPreview.value.trim()) {
        try {
            // 验证预览区内容是否为有效的JSON
            JSON.parse(decryptJsonPreview.value);
            downloadFile(decryptJsonPreview.value, `${decryptedFileName || 'decrypted_data'}decrypted.json`, 'application/json');
            showStatus("解密文件导出成功");
        } catch (error) {
            showStatus(`导出失败: 预览区内容不是有效的JSON`, true);
        }
    } else {
        showStatus("没有可导出的解密文件", true);
    }
});

// 媒体文件还原相关功能
const mediaFileInput = document.getElementById("media-file");
const mediaFilesList = document.getElementById("media-files-list");
const mediaDecryptBtn = document.getElementById("media-decrypt-btn");
const mediaExportBtn = document.getElementById("media-export-btn");
const mediaKeyInput = document.getElementById("media-key");
const useNoKeyMethod = document.getElementById("use-no-key-method");

// 预览窗口相关元素
const previewModal = document.getElementById("preview-modal");
const closeModal = document.getElementsByClassName("close-modal")[0];
const previewTitle = document.getElementById("preview-title");
const previewContainer = document.getElementById("preview-container");

// 存储选择的文件和处理后的文件
let selectedFiles = [];
let processedFiles = [];

// 监听文件选择
mediaFileInput.addEventListener("change", (event) => {
    const files = event.target.files;
    if (files.length > 0) {
        // 清空之前的文件列表
        selectedFiles = [];
        
        // 添加新选择的文件
        for (let i = 0; i < files.length; i++) {
            selectedFiles.push({
                file: files[i],
                name: files[i].name,
                size: files[i].size,
                selected: true // 默认选中
            });
        }
        
        // 更新文件列表显示
        updateFileList();
    }
});

// 更新文件列表显示
function updateFileList() {
    mediaFilesList.innerHTML = '';
    
    if (selectedFiles.length === 0) {
        mediaFilesList.innerHTML = '<p class="empty-message">尚未选择文件</p>';
        return;
    }
    
    selectedFiles.forEach((fileInfo, index) => {
        if (fileInfo.selected) {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.setAttribute('data-index', index);
            
            // 格式化文件大小
            const fileSize = formatFileSize(fileInfo.size);
            
            // 检查文件是否已处理
            const processedFile = processedFiles.find(f => f.name === fileInfo.name);
            const statusText = processedFile ? ' (已还原)' : '';
            
            fileItem.innerHTML = `
                <div class="file-info">
                    <div class="file-name">${fileInfo.name}<span style="color: #28a745; font-size: 12px;">${statusText}</span></div>
                    <div class="file-size">${fileSize}</div>
                </div>
                <div class="file-actions">
                    <button class="file-action-btn preview-btn" data-index="${index}">预览</button>
                    <button class="file-action-btn download-btn" data-index="${index}">下载</button>
                    <button class="file-action-btn remove-btn" data-index="${index}">删除</button>
                </div>
            `;
            
            mediaFilesList.appendChild(fileItem);
        }
    });
    
    // 为按钮添加事件监听
    addFileActionListeners();
}

// 添加文件操作按钮的事件监听
function addFileActionListeners() {
    // 预览按钮
    document.querySelectorAll('.preview-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            previewFile(index);
        });
    });
    
    // 下载按钮
    document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            downloadFileFromList(index);
        });
    });
    
    // 删除按钮
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            removeFile(index);
        });
    });
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 预览文件
function previewFile(index) {
    const fileInfo = selectedFiles[index];
    
    // 检查文件是否已处理
    const processedFile = processedFiles.find(f => f.name === fileInfo.name);
    
    if (processedFile && processedFile.content) {
        // 如果已处理，预览处理后的文件
        previewTitle.textContent = `预览: ${fileInfo.name} (已还原)`;
        
        // 清除之前的预览内容
        previewContainer.innerHTML = '';
        
        // 创建图片元素
        const img = document.createElement('img');
        
        // 创建Blob URL用于预览还原后的图片
        const blob = new Blob([processedFile.content], { type: fileInfo.file.type });
        img.src = URL.createObjectURL(blob);
        
        img.onload = function() {
            // 释放URL对象
            URL.revokeObjectURL(img.src);
        };
        
        previewContainer.appendChild(img);
        
        // 显示预览窗口
        previewModal.style.display = 'block';
    } else if (fileInfo.file.type.startsWith('image/')) {
        // 如果未处理，预览原始文件
        previewTitle.textContent = `预览: ${fileInfo.name} (原始)`;
        
        // 清除之前的预览内容
        previewContainer.innerHTML = '';
        
        // 创建图片元素
        const img = document.createElement('img');
        img.src = URL.createObjectURL(fileInfo.file);
        img.onload = function() {
            // 释放URL对象
            URL.revokeObjectURL(img.src);
        };
        
        previewContainer.appendChild(img);
        
        // 显示预览窗口
        previewModal.style.display = 'block';
    } else {
        showStatus('仅支持图片文件预览', true);
    }
}

// 从列表下载文件
function downloadFileFromList(index) {
    const fileInfo = selectedFiles[index];
    
    // 检查文件是否已处理
    const processedFile = processedFiles.find(f => f.name === fileInfo.name);
    
    if (processedFile && processedFile.content) {
        // 如果已处理，下载处理后的文件
        const blob = new Blob([processedFile.content], { type: fileInfo.file.type });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileInfo.name;
        a.click();
        
        URL.revokeObjectURL(url);
        showStatus(`文件 ${fileInfo.name} 下载成功`);
    } else {
        // 如果未处理，下载原始文件
        const url = URL.createObjectURL(fileInfo.file);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileInfo.name;
        a.click();
        
        URL.revokeObjectURL(url);
        showStatus(`原始文件 ${fileInfo.name} 下载成功`);
    }
}

// 移除文件
function removeFile(index) {
    // 将文件标记为未选中，而不是从数组中删除，这样在打包时就不会包含它
    selectedFiles[index].selected = false;
    
    // 更新文件列表
    updateFileList();
    
    showStatus(`文件已从列表中移除`);
}

// 关闭预览窗口
closeModal.addEventListener('click', () => {
    previewModal.style.display = 'none';
});

// 点击窗口外部关闭预览
window.addEventListener('click', (event) => {
    if (event.target === previewModal) {
        previewModal.style.display = 'none';
    }
});

// 还原媒体文件按钮点击事件
mediaDecryptBtn.addEventListener("click", async () => {
    const key = mediaKeyInput.value;
    const useNoKey = useNoKeyMethod.checked;
    
    if (!selectedFiles.some(f => f.selected)) {
        showStatus("请先选择要还原的文件", true);
        return;
    }
    
    if (!useNoKey && !key) {
        showStatus("请输入解密密钥或选择无需密钥还原", true);
        return;
    }
    
    try {
        showStatus("正在还原文件中...");
        
        // 清空之前处理的文件
        processedFiles = [];
        
        // 处理每个选中的文件
        for (const fileInfo of selectedFiles) {
            if (fileInfo.selected) {
                await processMediaFile(fileInfo, key, useNoKey);
            }
        }
        
        // 启用导出按钮
        mediaExportBtn.disabled = false;
        
        showStatus("文件还原成功，请点击下载ZIP文件按钮下载");
    } catch (error) {
        showStatus(`还原失败: ${error.message}`, true);
    }
});

// 处理单个媒体文件
function processMediaFile(fileInfo, key, useNoKey) {
    return new Promise((resolve, reject) => {
        try {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    let decryptedContent;
                    
                    if (useNoKey) {
                        // 无需密钥还原方式
                        // 使用Decrypter.js中的restorePngHeader方法
                        const decrypter = new Decrypter(key);
                        decrypter.ignoreFakeHeader = true;
                        decryptedContent = decrypter.restorePngHeader(e.target.result);
                    } else {
                        // 使用密钥还原
                        // 使用Decrypter.js中的decrypt方法
                        const decrypter = new Decrypter(key);
                        decryptedContent = decrypter.decrypt(e.target.result);
                    }
                    
                    // 存储处理后的文件
                    processedFiles.push({
                        name: fileInfo.name,
                        content: decryptedContent
                    });
                    
                    // 更新文件列表，显示还原后的状态
                    updateFileList();
                    
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = function() {
                reject(new Error(`文件读取失败: ${fileInfo.name}`));
            };
            
            // 读取文件为ArrayBuffer
            reader.readAsArrayBuffer(fileInfo.file);
        } catch (error) {
            reject(error);
        }
    });
}

// 下载ZIP文件按钮点击事件
mediaExportBtn.addEventListener("click", () => {
    if (processedFiles.length === 0) {
        showStatus("没有可导出的文件", true);
        return;
    }
    
    try {
        showStatus("正在生成ZIP文件...");
        
        // 使用JSZip创建ZIP文件
        const zip = new JSZip();
        
        // 添加处理后的文件到ZIP，确保正确处理ArrayBuffer内容
        // 只添加那些对应的原始文件仍被选中的文件
        processedFiles.forEach(file => {
            // 查找原始文件信息以获取正确的MIME类型和选择状态
            const originalFileInfo = selectedFiles.find(f => f.name === file.name);
            
            // 只有当原始文件仍被选中时，才添加到ZIP
            if (originalFileInfo && originalFileInfo.selected) {
                const mimeType = originalFileInfo.file.type;
                
                // 检查内容类型，确保正确处理ArrayBuffer
                if (file.content instanceof ArrayBuffer) {
                    // 对于ArrayBuffer，明确指定为二进制内容添加到ZIP
                    zip.file(file.name, file.content, {binary: true});
                } else {
                    // 其他类型也尝试添加
                    zip.file(file.name, file.content);
                }
            }
        });
        
        // 生成并下载ZIP文件
        zip.generateAsync({type: 'blob'}).then(function(blob) {
            saveAs(blob, 'decryptedmediafiles.zip');
            showStatus("ZIP文件下载成功");
        }).catch(function(error) {
            showStatus(`ZIP文件生成失败: ${error.message}`, true);
        });
    } catch (error) {
        showStatus(`ZIP文件生成失败: ${error.message}`, true);
    }
});