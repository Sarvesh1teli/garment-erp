import metadata from '../../package.json';
export const packageVersion=metadata.version;
export const appVersion=packageVersion.split('.').map((part,index)=>index===2?part.padStart(3,'0'):part).join('.');
export const buildDate=typeof __APP_BUILD_DATE__==='string'?__APP_BUILD_DATE__:'Development build';
