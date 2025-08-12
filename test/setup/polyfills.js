// fetch API を Node (Jest) でも使えるようにする
import 'whatwg-fetch';

// TextEncoder / TextDecoder のポリフィル（Node 環境で必要になることがある）
import { TextEncoder, TextDecoder } from 'util';
if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;
