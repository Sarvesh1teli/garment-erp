/// <reference types="vite/client" />

declare global {
  const __APP_BUILD_DATE__: string;
  interface Window {
    threadflow?: { garmentSmsRequest:(endpoint:string,options?:{method?:string;body?:string;tenantId?:string})=>Promise<any>; savePdf: () => Promise<{ saved: boolean; filePath?: string }>; syncGarmentBusinessName:(name:string)=>Promise<{synced:boolean}>; publishGarmentTypes:(types:import("./shared/garmentCatalog").GarmentType[])=>Promise<{synced:boolean}>; garmentCloudSnapshot:()=>Promise<any>; garmentCloudRequest:(endpoint:string,options?:{method?:string;body?:string;businessName?:string})=>Promise<any>; exportGarmentBusiness:()=>Promise<boolean>; resetGarmentBusiness?:(businessName?:string)=>Promise<boolean>; importGarmentBusiness:()=>Promise<boolean> };
  }
}

export {};
