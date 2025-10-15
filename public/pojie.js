/**
 * 图片音频还原破解工具
 *
 * 此脚本同时支持：
 * 1. 浏览器环境：可在网页中选择多个文件进行还原
 * 2. 命令行环境：可处理单个文件或整个目录
 *
 * 命令行使用方式：
 *   node public/pojie.js <file_or_dir>
 *   node public/pojie.js <file_or_dir> --key <hex-or-16-char-key>
 *
 * 支持AES-128-ECB解密
 */

// 检测是否在浏览器环境中运行
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

// 根据环境导入不同的模块
let fs, path, crypto;
if (!isBrowser) {
    // Node.js环境
    fs = require('fs').promises;
    path = require('path');
    crypto = require('crypto');
}

// 浏览器环境下的工具函数
if (isBrowser) {
    // 全局变量存储解密结果
    window.decryptedFiles = [];
    window.downloadAllDecryptedFiles = downloadAllDecryptedFiles;
}

function usageAndExit(msg) {
  if (msg) console.error(msg);
  console.log(`
Usage:
  node rpgm_decrypt.js <file_or_dir> [--key <hex-or-16-char-key>]

Examples:
  node rpgm_decrypt.js www/img
  node rpgm_decrypt.js www/img/Actor1.png_ --key e10adc3949ba59abbe56e057f20f883e
  node rpgm_decrypt.js www/img --key "16-char-key-here"
`);
  process.exit(msg ? 1 : 0);
}

function isHex(str) {
  return /^[0-9a-fA-F]+$/.test(str);
}

async function readSystemKey(rootDir) {
  const sysPath = path.join(rootDir, 'www', 'data', 'System.json');
  try {
    const txt = await fs.readFile(sysPath, 'utf8');
    const j = JSON.parse(txt);
    if (j && j.encryptionKey) return j.encryptionKey;
    // Some RPG Maker outputs may use other keys; try common names
    if (j && j.hasEncryptedImages && j.encryptionKey) return j.encryptionKey;
    return null;
  } catch (e) {
    return null;
  }
}

function normalizeKey(keyStr) {
  // Accept hex (32 hex chars -> 16 bytes) or 16-char utf8 string
  if (!keyStr) return null;
  
  if (isHex(keyStr) && keyStr.length === 32) {
    if (isBrowser) {
      // 浏览器环境下将十六进制字符串转换为Uint8Array
      const bytes = new Uint8Array(16);
      for (let i = 0; i < 32; i += 2) {
        bytes[i / 2] = parseInt(keyStr.substr(i, 2), 16);
      }
      return bytes;
    } else {
      // Node.js环境
      return Buffer.from(keyStr, 'hex');
    }
  }
  
  // 处理UTF-8字符串
  if (isBrowser) {
    // 浏览器环境下使用TextEncoder将字符串转换为UTF-8字节
    const encoder = new TextEncoder();
    const bytes = encoder.encode(keyStr);
    if (bytes.length === 16) return bytes;
  } else {
    // Node.js环境
    const b = Buffer.from(keyStr, 'utf8');
    if (b.length === 16) return b;
  }
  
  // 如果不符合要求，明确抛出错误
  throw new Error('提供的密钥必须是32位十六进制字符(16字节)或16位字符串。');
}

function stripPKCS7(buf) {
  if (!buf || buf.length === 0) return buf;
  
  // 获取最后一个字节作为填充长度
  const pad = buf[buf.length - 1];
  
  if (pad >= 1 && pad <= 16) {
    // 检查填充是否有效
    let ok = true;
    for (let i = 0; i < pad; i++) {
      if (buf[buf.length - 1 - i] !== pad) { 
        ok = false;
        break;
      }
    }
    
    if (ok) {
      // 根据不同的类型返回相应的结果
      if (isBrowser && buf instanceof Uint8Array) {
        return buf.slice(0, buf.length - pad);
      } else if (Buffer.isBuffer(buf)) {
        return buf.slice(0, buf.length - pad);
      } else {
        // 其他类型，尝试转换为数组并返回
        const result = Array.from(buf).slice(0, buf.length - pad);
        return isBrowser ? new Uint8Array(result) : Buffer.from(result);
      }
    }
  }
  
  return buf;
}

function findPngStart(buf) {
  // PNG文件头的魔数
  const pngMagic = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  
  // 处理不同类型的缓冲区
  if (isBrowser && buf instanceof Uint8Array) {
    // 浏览器环境处理Uint8Array
    for (let i = 0; i <= buf.length - pngMagic.length; i++) {
      let matched = true;
      for (let j = 0; j < pngMagic.length; j++) {
        if (buf[i + j] !== pngMagic[j]) {
          matched = false;
          break;
        }
      }
      if (matched) return i;
    }
  } else if (Buffer.isBuffer(buf)) {
    // Node.js环境处理Buffer
    const pngMagicBuf = Buffer.from(pngMagic);
    for (let i = 0; i <= buf.length - pngMagicBuf.length; i++) {
      let matched = true;
      for (let j = 0; j < pngMagicBuf.length; j++) {
        if (buf[i + j] !== pngMagicBuf[j]) {
          matched = false;
          break;
        }
      }
      if (matched) return i;
    }
  } else {
    // 其他类型，尝试作为数组处理
    for (let i = 0; i <= buf.length - pngMagic.length; i++) {
      let matched = true;
      for (let j = 0; j < pngMagic.length; j++) {
        if (buf[i + j] !== pngMagic[j]) {
          matched = false;
          break;
        }
      }
      if (matched) return i;
    }
  }
  
  return -1;
}

function decryptAesEcbNoAutoPadding(encryptedBuf, keyBuf) {
  if (isBrowser) {
    // 浏览器环境使用CryptoJS
    // 将Buffer转换为WordArray
    const encryptedWordArray = CryptoJS.lib.WordArray.create(encryptedBuf);
    const keyWordArray = CryptoJS.lib.WordArray.create(keyBuf);
    
    // 使用ECB模式解密，禁用自动填充
    const decrypted = CryptoJS.AES.decrypt({
      ciphertext: encryptedWordArray
    }, keyWordArray, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.NoPadding
    });
    
    // 将WordArray转换为Uint8Array
    const decryptedBytes = decrypted.sigBytes > 0 ? decrypted.words : [];
    const decryptedArray = [];
    for (let i = 0; i < decrypted.sigBytes; i++) {
      const byte = (decryptedBytes[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
      decryptedArray.push(byte);
    }
    return new Uint8Array(decryptedArray);
  } else {
    // Node.js环境使用crypto模块
    // AES-128-ECB decryption; disable auto padding (we'll handle PKCS#7 manually)
    const decipher = crypto.createDecipheriv('aes-128-ecb', keyBuf, null);
    decipher.setAutoPadding(false);
    const out1 = decipher.update(encryptedBuf);
    const out2 = decipher.final();
    return Buffer.concat([out1, out2]);
  }
}

// 浏览器环境下的文件处理函数
function browserDecryptFile(file, keyBuf) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target.result;
        const raw = new Uint8Array(arrayBuffer);
        
        if (raw.length <= 16) {
          throw new Error('文件太小，可能不是加密文件');
        }

        // 跳过16字节头
        const enc = raw.slice(16);

        // 解密数据
        let decRaw = decryptAesEcbNoAutoPadding(enc, keyBuf);
        
        // 将Uint8Array转换为Buffer以便处理
        if (decRaw instanceof Uint8Array) {
          decRaw = Buffer.from(decRaw);
        }

        // 尝试去除PKCS#7填充
        let dec = stripPKCS7(decRaw);

        // 寻找PNG文件头
        const pngIdx = findPngStart(dec);
        if (pngIdx >= 0) {
          dec = dec.slice(pngIdx);
        } else {
          // 检查Ogg文件头
          const oggMagic = Buffer.from('OggS');
          const oggIdx = dec.indexOf(oggMagic);
          if (oggIdx >= 0) dec = dec.slice(oggIdx);
        }

        // 确定文件扩展名
        let ext = file.name.split('.').pop();
        if (ext.endsWith('_')) {
          ext = ext.slice(0, -1);
        }

        const outName = file.name.replace(/\.[^/.]+$/, '').replace(/_$/, '') + '.' + ext;
        
        // 保存解密结果
        window.decryptedFiles.push({
          name: outName,
          content: dec
        });

        resolve(outName);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

// 下载所有解密文件
function downloadAllDecryptedFiles() {
  if (window.decryptedFiles.length === 0) {
    showStatus('没有可下载的解密文件', true);
    return;
  }
  
  // 如果只有一个文件，直接下载
  if (window.decryptedFiles.length === 1) {
    const file = window.decryptedFiles[0];
    const blob = new Blob([file.content], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    showStatus(`已下载文件: ${file.name}`);
    return;
  }
  
  // 如果有多个文件，使用ZIP.js打包成一个ZIP文件后下载
  showStatus('正在打包多个文件为ZIP...', false);
  
  // 创建ZIP对象
  const zip = new ZIP();
  
  // 将所有解密的文件添加到ZIP中
  window.decryptedFiles.forEach(file => {
    // 创建一个简单的RPGFile-like对象以适配ZIP类
    const rpgFile = {
      name: file.name.replace(/\.[^/.]+$/, ''), // 去掉扩展名
      extension: file.name.split('.').pop(), // 获取扩展名
      content: file.content, // 文件内容
      dispose: function() {
        this.content = null;
      }
    };
    zip.addFile(rpgFile);
  });
  
  // 保存ZIP文件
  zip.save();
  
  // 显示下载完成的消息
  showStatus('所有文件已打包为ZIP文件并开始下载');
  
  // 释放ZIP对象资源
  setTimeout(() => {
    zip.dispose();
  }, 1000);
}

async function decryptFile(filePath, keyBuf, outDir) {
  const base = path.basename(filePath);
  let outName = base;
  // remove trailing underscore (e.g., Actor1.png_ -> Actor1.png)
  if (outName.endsWith('_')) outName = outName.slice(0, -1);

  const outPath = path.join(outDir, outName);

  const raw = await fs.readFile(filePath);
  if (raw.length <= 16) throw new Error('Encrypted file too small: ' + filePath);

  // Some RPG Maker encrypted files contain a 16-byte header (skip it)
  const header = raw.slice(0, 16);
  const enc = raw.slice(16);

  const decRaw = decryptAesEcbNoAutoPadding(enc, keyBuf);

  // try PKCS#7 strip
  let dec = stripPKCS7(decRaw);

  // If the decrypted content doesn't start with PNG magic, try to find PNG start inside
  const pngIdx = findPngStart(dec);
  if (pngIdx >= 0) {
    dec = dec.slice(pngIdx);
  } else {
    // If not PNG, we still keep dec as-is (for ogg or other files).
    // For ogg, check OggS header
    const oggMagic = Buffer.from('OggS');
    const oggIdx = dec.indexOf(oggMagic);
    if (oggIdx >= 0) dec = dec.slice(oggIdx);
  }

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, dec);
  return outPath;
}

async function walkAndCollect(startDir) {
  const results = [];
  async function walk(dir) {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const it of items) {
      const full = path.join(dir, it.name);
      if (it.isDirectory()) await walk(full);
      else {
        // target files end with underscore, or commonly .png_ .ogg_ .m4a_ etc.
        if (it.name.endsWith('_')) results.push(full);
      }
    }
  }
  await walk(startDir);
  return results;
}

// 无需密钥的文件还原函数
function browserRestoreFileWithoutKey(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target.result;
        if (!arrayBuffer) {
          throw new Error('文件为空');
        }

        // 使用Decrypter类进行无密钥还原
        const decrypter = new Decrypter();
        const restoredBuffer = decrypter.restorePngHeader(arrayBuffer);

        // 确定文件扩展名
        let ext = file.name.split('.').pop();
        if (ext.endsWith('_')) {
          ext = ext.slice(0, -1);
        }

        const outName = file.name.replace(/\.[^/.]+$/, '').replace(/_$/, '') + '.' + ext;
        
        // 保存还原结果
        window.decryptedFiles.push({
          name: outName,
          content: new Uint8Array(restoredBuffer)
        });

        resolve(outName);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

// 浏览器环境初始化
if (isBrowser) {
  document.addEventListener('DOMContentLoaded', () => {
    // 媒体解密相关DOM元素
    const mediaKeyInput = document.getElementById('media-key');
    const mediaFileInput = document.getElementById('media-file');
    const mediaFilesList = document.getElementById('media-files-list');
    const mediaDecryptBtn = document.getElementById('media-decrypt-btn');
    const mediaExportBtn = document.getElementById('media-export-btn');
    const useNoKeyMethod = document.getElementById('use-no-key-method');
    
    // 显示文件列表
    mediaFileInput.addEventListener('change', () => {
      const files = mediaFileInput.files;
      if (files.length === 0) {
        mediaFilesList.value = '';
        return;
      }
      
      const fileNames = Array.from(files).map(file => file.name).join('\n');
      mediaFilesList.value = fileNames;
    });

    // 无密钥选项切换时控制密钥输入框状态
    if (useNoKeyMethod) {
      useNoKeyMethod.addEventListener('change', () => {
        mediaKeyInput.disabled = useNoKeyMethod.checked;
      });
    }
    
    // 还原文件按钮点击事件
      mediaDecryptBtn.addEventListener('click', async () => {
        const key = mediaKeyInput.value;
        const files = mediaFileInput.files;
        const useNoKey = useNoKeyMethod && useNoKeyMethod.checked;
        
        if (!useNoKey && !key) {
          showStatus('请输入解密密钥', true);
          return;
        }
        
        if (files.length === 0) {
          showStatus('请选择要还原的文件', true);
          return;
        }
        
        try {
          // 重置解密结果列表
          window.decryptedFiles = [];
          
          let keyBuf;
          if (!useNoKey) {
            // 规范化密钥
            try {
              keyBuf = normalizeKey(key);
            } catch (error) {
              showStatus(`密钥格式错误: ${error.message}`, true);
              return;
            }
          }
          
          showStatus(`开始${useNoKey ? '无密钥还原' : '还原'} ${files.length} 个文件...`, false);
          
          // 逐个处理文件
          const failedFiles = [];
          for (let i = 0; i < files.length; i++) {
            try {
              const file = files[i];
              showStatus(`正在${useNoKey ? '无密钥还原' : '还原'}: ${file.name} (${i+1}/${files.length})`, false);
              if (useNoKey) {
                await browserRestoreFileWithoutKey(file);
              } else {
                await browserDecryptFile(file, keyBuf);
              }
            } catch (error) {
              failedFiles.push({name: files[i].name, error: error.message});
            }
          }
          
          // 显示结果
          if (window.decryptedFiles.length > 0) {
            mediaExportBtn.disabled = false;
            let message = `成功${useNoKey ? '无密钥还原' : '还原'} ${window.decryptedFiles.length} 个文件`;
            if (failedFiles.length > 0) {
              message += `，失败 ${failedFiles.length} 个文件`;
              console.error('处理失败的文件:', failedFiles);
            }
            showStatus(message);
          } else {
            showStatus(`所有文件${useNoKey ? '无密钥还原' : '还原'}失败，请尝试${useNoKey ? '使用密钥还原' : '检查密钥是否正确或尝试无密钥还原'}`, true);
          }
        } catch (error) {
          showStatus(`处理过程出错: ${error.message}`, true);
        }
      });
    
    // 下载还原文件按钮点击事件
    mediaExportBtn.addEventListener('click', () => {
      downloadAllDecryptedFiles();
    });
  });
} else {
  // 命令行环境执行
  (async () => {
    try {
      const argv = process.argv.slice(2);
      if (argv.length === 0) usageAndExit();

      // parse --key option
      let keyArg = null;
      const keyIdx = argv.indexOf('--key');
      if (keyIdx !== -1) {
        if (argv.length <= keyIdx + 1) usageAndExit('--key requires a value');
        keyArg = argv[keyIdx + 1];
        argv.splice(keyIdx, 2);
      }

      const target = argv[0];
      if (!target) usageAndExit();

      // attempt to read System.json from current working dir
      const cwd = process.cwd();
      let keyStr = null;
      if (keyArg) keyStr = keyArg;
      else {
        const sysKey = await readSystemKey(cwd);
        if (sysKey) {
          console.log('[*] 从 www/data/System.json 读取到 encryptionKey');
          keyStr = sysKey;
        }
      }

      if (!keyStr) {
        usageAndExit('找不到 encryptionKey。请在 www/data/System.json 中检查或通过 --key 提供密钥。');
      }

      const keyBuf = normalizeKey(keyStr);

      const stat = await fs.stat(target);
      const outDir = path.join(process.cwd(), 'decrypted_out');

      if (stat.isFile()) {
        console.log('[*] 解密文件：', target);
        const out = await decryptFile(target, keyBuf, outDir);
        console.log('-> 已写出：', out);
      } else if (stat.isDirectory()) {
        console.log('[*] 遍历目录并解密所有以 "_" 结尾的文件：', target);
        const files = await walkAndCollect(target);
        if (files.length === 0) {
          console.log('未找到以 "_" 结尾的文件。检查目录或确认文件扩展名是否为 .png_ 等。');
          process.exit(0);
        }
        console.log(`找到 ${files.length} 个文件，开始解密...`);
        for (let i = 0; i < files.length; i++) {
          try {
            const f = files[i];
            process.stdout.write(`(${i+1}/${files.length}) ${path.relative(process.cwd(), f)} -> `);
            const out = await decryptFile(f, keyBuf, outDir);
            console.log(path.relative(process.cwd(), out));
          } catch (e) {
            console.error('\n  解密失败：', e.message);
          }
        }
        console.log('全部处理完成，输出目录：', outDir);
      } else {
        usageAndExit('目标不是文件或目录');
      }
    } catch (err) {
      console.error('错误：', err.message);
      process.exit(1);
    }
  })();
}
