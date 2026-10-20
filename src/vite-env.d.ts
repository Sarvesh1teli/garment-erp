/// <reference types="vite/client" />

declare global {
  interface Window {
    threadflow?: { savePdf: () => Promise<{ saved: boolean; filePath?: string }>; syncGarmentBusinessName:(name:string)=>Promise<{synced:boolean}>; publishGarmentTypes:(types:import("./shared/garmentCatalog").GarmentType[])=>Promise<{synced:boolean}>; garmentCloudSnapshot:()=>Promise<any>; garmentCloudRequest:(endpoint:string,options?:{method?:string;body?:string;businessName?:string})=>Promise<any>; exportGarmentBusiness:()=>Promise<boolean>; importGarmentBusiness:()=>Promise<boolean> };
  }
}

export {};
