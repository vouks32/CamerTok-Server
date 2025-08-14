import Tiktok from '@tobyg74/tiktok-api-dl'
import { GetTiktokInfo } from "./api/user.js";

console.log((await Tiktok.GetUserPosts('ericassiang',{
    postLimit : 10
})).totalPosts)

