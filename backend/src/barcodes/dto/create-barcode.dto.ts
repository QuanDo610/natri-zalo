export class CreateBarcodeDto {
  code: string;
  productSku: string;
}

export class CreateBarcodeBatchDto {
  items: { code: string; productSku: string }[];
}
