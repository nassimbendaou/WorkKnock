declare module 'node-telegram-bot-api' {
  interface SendMessageOptions {
    parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML';
    disable_web_page_preview?: boolean;
    disable_notification?: boolean;
    reply_to_message_id?: number;
    reply_markup?: any;
  }

  interface SendDocumentOptions {
    caption?: string;
    parse_mode?: string;
    disable_notification?: boolean;
    reply_to_message_id?: number;
  }

  interface FileOptions {
    filename?: string;
    contentType?: string;
  }

  interface ConstructorOptions {
    polling?: boolean | object;
    webHook?: boolean | object;
    filepath?: boolean;
  }

  interface Message {
    message_id: number;
    from?: any;
    chat: {
      id: number;
      type: string;
      title?: string;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    date: number;
    text?: string;
    entities?: any[];
    document?: any;
    photo?: any[];
  }

  class TelegramBot {
    constructor(token: string, options?: ConstructorOptions);
    sendMessage(chatId: string | number, text: string, options?: SendMessageOptions): Promise<Message>;
    sendDocument(chatId: string | number, doc: string | Buffer | ReadableStream, options?: SendDocumentOptions, fileOptions?: FileOptions): Promise<Message>;
    setWebHook(url: string, options?: any): Promise<any>;
    deleteWebHook(): Promise<boolean>;
    getMe(): Promise<any>;
    on(event: string, callback: (...args: any[]) => void): void;
  }

  export = TelegramBot;
}
