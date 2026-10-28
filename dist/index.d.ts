import { PicGo } from 'picgo';
declare const _default: (ctx: PicGo) => {
    uploader: string;
    transformer: string;
    commands: (ctx: PicGo) => {
        label: string;
        key: string;
        name: string;
        handle(ctx: PicGo, guiApi: any): Promise<void>;
    }[];
    register: () => void;
};
export = _default;
