const express = require('express');
const path = require('path');
const fs = require('fs');
const CryptoJS = require('crypto-js');
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件设置
app.use(express.static('public'));
app.use(express.json({ limit: '50mb' }));

// 确保临时目录存在
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// 处理加密请求
app.post('/api/encrypt', (req, res) => {
  try {
    const { data, key } = req.body;
    
    if (!data || !key) {
      return res.status(400).json({ error: '数据和密钥不能为空' });
    }
    
    // 加密数据
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
    
    res.json({ encrypted });
  } catch (error) {
    res.status(500).json({ error: '加密失败: ' + error.message });
  }
});

// 处理解密请求
app.post('/api/decrypt', (req, res) => {
  try {
    const { encryptedData, key } = req.body;
    
    if (!encryptedData || !key) {
      return res.status(400).json({ error: '加密数据和密钥不能为空' });
    }
    
    // 解密数据
    const bytes = CryptoJS.AES.decrypt(encryptedData, key);
    const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedText) {
      return res.status(400).json({ error: '解密失败: 无效的密钥或数据' });
    }
    
    const decryptedData = JSON.parse(decryptedText);
    res.json({ decrypted: decryptedData });
  } catch (error) {
    res.status(500).json({ error: '解密失败: ' + error.message });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});