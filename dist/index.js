"use strict";
// Define the IWechatConfig interface according to your config structure
const CONFIG_NAME = 'picgo-plugin-bilibili-uploader';
// 常见图片扩展名 -> MIME 类型映射，用于 multipart 上传时的 contentType 声明
const MIME_MAP = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp'
};
module.exports = (ctx) => {
    const config = () => {
        return [
            {
                name: 'bili_jct',
                type: 'input',
                message: '获取教程：https://xlzy520.cn/pages/8b9f9f/',
                required: true
            },
            {
                name: 'SESSDATA',
                type: 'input',
                message: '获取教程：https://xlzy520.cn/pages/8b9f9f/',
                required: true
            }
        ];
    };
    const handleUpload = async (ctx) => {
        var _a;
        try {
            // GUI 图床配置面板将本上传器的配置保存在 picBed.<CONFIG_NAME>
            const userConfig = ctx.getConfig(`picBed.${CONFIG_NAME}`);
            if (!userConfig) {
                throw new Error('未获取到bilibili图床配置');
            }
            const { bili_jct, SESSDATA } = userConfig;
            // 处理所有图片
            for (const img of ctx.output) {
                // 检查图片大小
                const imageSizeMB = img.buffer.length / (1024 * 1024);
                if (imageSizeMB > 10) {
                    throw new Error(`图片大小 ${imageSizeMB.toFixed(2)}MB 超过限制 10MB`);
                }
                // 上传到bilibili
                ctx.log.info('upload :', img.fileName, img.extname, img.buffer.length, 'bytes');
                // 端点: POST https://member.bilibili.com/x/vu/web/cover/up（视频封面上传）
                // 说明：api.bilibili.com 的 upcover 接口上传的图片（bfs/new_dyn）因未被专栏文章引用
                // 会被 B 站定期清理（实测数小时后 404），故改用本接口（bfs/archive，长期存活）
                // 图片以 base64 提交，form 选项会自动完成 URL 编码，Cookie 鉴权
                const mimeType = MIME_MAP[(img.extname || '').toLowerCase()] || 'image/png';
                const base64 = img.buffer.toString('base64');
                const rawResponse = await ctx.request({
                    url: `https://member.bilibili.com/x/vu/web/cover/up`,
                    method: 'POST',
                    headers: {
                        'Cookie': `SESSDATA=${SESSDATA}; bili_jct=${bili_jct}`,
                        'Origin': "https://member.bilibili.com",
                        'Referer': "https://member.bilibili.com/",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
                    },
                    form: {
                        csrf: bili_jct,
                        cover: `data:${mimeType};base64,${base64}`
                    }
                });
                // request 库可能返回字符串或已解析对象，统一处理为对象
                const uploadResponse = typeof rawResponse === 'string' ? JSON.parse(rawResponse) : rawResponse;
                ctx.log.info('bilibili图床上传响应', uploadResponse);
                if (uploadResponse.code) {
                    throw new Error(`上传失败: ${uploadResponse.message}`);
                }
                // 成功时返回 { code: 0, message: "OK", data: { url } }
                const rawUrl = (_a = uploadResponse === null || uploadResponse === void 0 ? void 0 : uploadResponse.data) === null || _a === void 0 ? void 0 : _a.url;
                if (!rawUrl) {
                    throw new Error(`bilibili图床返回的URL为空: ${(uploadResponse === null || uploadResponse === void 0 ? void 0 : uploadResponse.message) || '未知响应'}`);
                }
                // // 保存结果（接口返回 http 链接，统一升级为 https 以便 Typora/网页外链使用）
                img.imgUrl = rawUrl.replace(/^http:\/\//, 'https://');
                img.fullResult = uploadResponse;
            }
            return true;
        }
        catch (err) {
            ctx.log.error('bilibili图床上传失败', err);
            ctx.emit('notification', {
                title: 'bilibili图床错误',
                body: err.message || '未知错误'
            });
            return false;
        }
    };
    const handleAfterUpload = async (ctx) => {
        try {
            // afterUploadPlugins 对所有图床都会执行，仅在当前使用本图床时才处理，避免改写其他图床的上传结果
            const currentUploader = ctx.getConfig('picBed.uploader') || ctx.getConfig('picBed.current');
            if (currentUploader !== CONFIG_NAME) {
                ctx.log.info(`当前使用非 bilibili图床，不处理上传后逻辑`);
                return true;
            }
            ctx.log.info('bilibili图床上传完成');
            // 为本图床的上传结果补充 Markdown 格式字段
            for (const img of ctx.output) {
                if (img.imgUrl) {
                    img.markdown = `![](${img.imgUrl})`;
                    ctx.log.info('bilibili图床上传完成，图片URL:', img.imgUrl);
                }
            }
        }
        catch (err) {
            ctx.log.error('上传后处理失败', err);
        }
        return true;
    };
    const register = () => {
        ctx.helper.uploader.register(CONFIG_NAME, {
            name: 'bilibili图床',
            handle: handleUpload,
            config: config,
        });
        // 不注册 transformer：使用默认 transformer（path）即可读取本地图片，避免选到空 transformer 导致上传失败
        ctx.helper.beforeTransformPlugins.register(CONFIG_NAME, {
            handle(ctx) {
            }
        });
        ctx.helper.beforeUploadPlugins.register(CONFIG_NAME, {
            handle(ctx) {
            }
        });
        ctx.helper.afterUploadPlugins.register(CONFIG_NAME, {
            handle: handleAfterUpload
        });
    };
    return {
        uploader: CONFIG_NAME,
        register
    };
};
