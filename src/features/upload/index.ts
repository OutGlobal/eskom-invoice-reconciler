/**
 * Upload Feature Module
 * Unified entry point for secure file ingestion and upload gateways
 */
export { SecureUploadGateway } from "@/components/upload/SecureUploadGateway";
export { SecureIngestionGateway } from "@/domain/ingestion/secureIngestionGateway";
export { UploadStorageService } from "@/domain/upload/uploadStorageService";
export type * from "@/domain/upload/types";
