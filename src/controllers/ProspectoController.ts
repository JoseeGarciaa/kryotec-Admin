import { ProspectoModel } from '../models/ProspectoModel';

export class ProspectoController {
  static async getProspectos() {
    return await ProspectoModel.getProspectos();
  }
}
