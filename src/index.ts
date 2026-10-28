import { PicGo } from 'picgo'
import { IPluginConfig  } from 'picgo/dist/utils/interfaces'
import { URL } from 'url'

// Define the IWechatConfig interface according to your config structure
const CONFIG_NAME = 'picgo-plugin-bilibili'

interface IBilibiliConfig {
  bili_jct: string
  SESSDATA: string
}

// 常见图片扩展名 -> MIME 类型映射，用于 multipart 上传时的 contentType 声明
const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp'
}



export = (ctx: PicGo) => {

  const config = (): IPluginConfig[] => {
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
    ]
  }
  

  const handleUpload = async (ctx: PicGo): Promise<boolean> => {
    try {
      const userConfig = ctx.getConfig<IBilibiliConfig>(`${CONFIG_NAME}`)
      if (!userConfig) {
        throw new Error('未获取到bilibili图床配置')
      }
      const { bili_jct, SESSDATA } = userConfig
     
      // 处理所有图片
      for (const img of ctx.output) {
        // 检查图片大小
        const imageSizeMB = img.buffer.length / (1024 * 1024)
        if (imageSizeMB > 10) {
          throw new Error(`图片大小 ${imageSizeMB.toFixed(2)}MB 超过限制 10MB`)
        }
        
        // 上传到bilibili
        ctx.log.info('upload :', img.fileName, img.extname, img.buffer.length, 'bytes');
        // 端点: POST https://api.bilibili.com/x/article/creative/article/upcover
        // 逆向自 wechatsync-2.0.9 扩展：表单字段名为 binary（图片二进制）+ csrf（bili_jct），
        // Cookie 需包含 SESSDATA 与 bili_jct，Origin/Referer 伪装成 member 后台页面
        const mimeType = MIME_MAP[(img.extname || '').toLowerCase()] || 'image/png'
        const uploadResponse:any = await ctx.request({
          url: `https://api.bilibili.com/x/article/creative/article/upcover`,
          method: 'POST',
          headers: {
               'Cookie': `SESSDATA=${SESSDATA}; bili_jct=${bili_jct}`,
               'Origin': "https://member.bilibili.com",
               'Referer': "https://member.bilibili.com/",
             "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
          },
          // request 库的 formData 文件字段必须使用 { value, options } 结构
          formData: {
            binary: {
              value: img.buffer,
              options: {
                filename: img.fileName,
                contentType: mimeType
              }
            },
            csrf: bili_jct
          },
          json: true
        })
        ctx.log.info('bilibili图床上传响应',uploadResponse)

        if (uploadResponse.code) {
          throw new Error(`上传失败: ${uploadResponse.message}`)
        }
        // 成功时返回 { code: 0, data: { url, size } }
        const rawUrl = uploadResponse?.data?.url
        if (!rawUrl) {
          throw new Error(`bilibili图床返回的URL为空: ${uploadResponse?.message || '未知响应'}`)
        }
        // // 保存结果（接口返回 http 链接，统一升级为 https 以便 Typora/网页外链使用）
        img.imgUrl = rawUrl.replace(/^http:\/\//, 'https://')
        img.fullResult = uploadResponse
      }
      return true
    } catch (err: any) {
      ctx.log.error('bilibili图床上传失败', err)
      ctx.emit('notification', {
        title: 'bilibili图床错误',
        body: err.message || '未知错误'
      })
      return false
    }
  }

  

  const handleAfterUpload = async (ctx: PicGo): Promise<boolean> => {

    try{
      const userConfig = ctx.getConfig<IBilibiliConfig>(`${CONFIG_NAME}`)
    // 这里可以处理上传后的逻辑，比如记录日志、发送通知等
      ctx.log.info('bilibili图床上传完成')
      //将微信原始URL转换为Markdown/CDN链接，通过afterUploadPlugins实现
      for (const img of ctx.output) {
        if (img.imgUrl) {
          let finalUrl = img.imgUrl
          // 这里假设你要将bilibili URL转换为Markdown格式
          img.imgUrl = finalUrl
          img.markdown = `![](${img.imgUrl})`
          ctx.log.info('bilibili图床上传完成，已应用CDN和Markdown转换')
        }
      }
    }catch(err: any) {
        ctx.log.error('上传后处理失败', err)
    }

     return true;
    }

  const register = (): void => {
    ctx.helper.uploader.register(CONFIG_NAME, {
      name: 'bilibili图床',
      handle: handleUpload,
      config: config,
      
    })
    ctx.helper.transformer.register(CONFIG_NAME, {
      handle (ctx) {
        console.log(ctx)
        ctx.output.forEach((item) => {
          console.log('处理图片:', item.fileName)
        })
        
      }
    })
    ctx.helper.beforeTransformPlugins.register(CONFIG_NAME, {
      handle (ctx) {
        console.log(ctx)
      }
    })
    ctx.helper.beforeUploadPlugins.register(CONFIG_NAME, {
      handle (ctx) {
        console.log(ctx)
      }
    })
    ctx.helper.afterUploadPlugins.register(CONFIG_NAME, {
      handle : handleAfterUpload
    })
  }
  const commands = (ctx: PicGo) => [{
    label: '',
    key: '',
    name: '',
    async handle (ctx: PicGo, guiApi: any) {}
  }]
  return {
    uploader: CONFIG_NAME,
    transformer: CONFIG_NAME,
    commands,
    register
  }
}
