export default {
  /**
   * MySQL数据库配置
   */
  MYSQL_HOST: '127.0.0.1',
  MYSQL_PORT: 3306,
  MYSQL_USERNAME: '',
  MYSQL_PASSWORD: '',
  MYSQL_DATABASE: '',

  /**
   * OPENAI相关配置
   */
  // OPENAI的APIKEY
  OPENAI_API_KEY: '',
  // OpenAI接口代理地址
  OPENAI_PROXY_URL: '',

  /**
   * 微信相关配置
   */
  // 自动添加好友打招呼（空数组为允许所有）
  WECHAT_FRIENDSHIP_KEYS: ['ChatGPT'],
  // 防撤回群聊名称（空数组为所有群聊防撤回）
  WECHAT_PREVENT_RECALL_NAMES: ['ChatGPT测试群'],
  // 内置聊天关键词（在聊天开头输入相关指令即可触发）修改需谨慎！！！
  WECHAT_CHAT_COMMAND: {
    // 系统指令，可指定机器人扮演角色
    SYSTEM: '/system',
    // 生成图片指令
    IMAGE: '/image'
  }
}
