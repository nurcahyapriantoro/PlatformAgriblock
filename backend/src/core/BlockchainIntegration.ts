import Transaction from "../transaction";
import { ProductStatus, TransactionActionType, UserRole } from "../enum";
import { getKeyPair } from "../../utils/keypair";
import BlockchainMiningService from "./BlockchainMiningService";
import { TransactionHistoryService } from "./TransactionHistory";

/**
 * Kelas untuk menangani integrasi dengan blockchain
 * Semua transaksi (create, transfer, verify) harus melalui kelas ini
 */
class BlockchainIntegration {
  private static instance: BlockchainIntegration;
  private transactionHandler: ((transaction: Transaction) => Promise<boolean>) | null = null;
  private miningService: BlockchainMiningService;

  private constructor() {
    // Private constructor untuk singleton
    this.miningService = BlockchainMiningService.getInstance();
    
    // Inisialisasi layanan mining dengan interval 2 menit
    setTimeout(() => {
      this.miningService.startMiningService(120);
      console.log("BlockchainMiningService dimulai");
    }, 5000); // Tunggu 5 detik setelah aplikasi dimulai
  }

  /**
   * Mendapatkan instance singleton dari kelas BlockchainIntegration
   */
  public static getInstance(): BlockchainIntegration {
    if (!BlockchainIntegration.instance) {
      BlockchainIntegration.instance = new BlockchainIntegration();
    }
    return BlockchainIntegration.instance;
  }

  /**
   * Menetapkan transaction handler dari blockchain
   * @param handler Fungsi handler yang akan memproses transaksi di blockchain
   */
  public setTransactionHandler(handler: (transaction: Transaction) => Promise<boolean>): void {
    this.transactionHandler = handler;
  }

  /**
   * Memproses transaksi dan menambahkannya ke daftar transaksi tertunda
   * @param transaction Transaksi yang akan diproses
   * @returns Hasil pemrosesan transaksi
   */
  private async processTransaction(transaction: Transaction): Promise<{ success: boolean; transactionHash?: string }> {
    try {
      // Tambahkan transaksi ke daftar transaksi tertunda untuk mining
      this.miningService.addPendingTransaction(transaction);
      
      // Jika ada handler eksternal, panggil
      if (this.transactionHandler) {
        await this.transactionHandler(transaction);
      }
      
      return {
        success: true,
        transactionHash: transaction.getHash()
      };
    } catch (error) {
      console.error("Error saat memproses transaksi:", error);
      return { success: false };
    }
  }

  /**
   * Mencatat transaksi pembuatan produk ke blockchain
   * @param productId ID produk
   * @param fromUserId ID pengguna pembuat produk
   * @param privateKey Kunci private untuk signing transaksi
   * @param productData Data produk
   * @returns Hasil pembuatan transaksi
   */
  public async recordProductCreation(
    productId: string,
    fromUserId: string,
    privateKey: string,
    productData: any
  ): Promise<{ success: boolean; transactionHash?: string; blockHash?: string }> {
    try {
      // Buat key pair dari private key
      const keyPair = getKeyPair(privateKey);
      const fromPublicKey = keyPair.getPublic("hex");
      
      // Buat transaksi blockchain
      const transaction = new Transaction({
        from: fromPublicKey,
        to: fromPublicKey, // Produk dibuat oleh dan untuk pengguna yang sama
        data: {
          type: "PRODUCT_CREATE",
          productId,
          details: productData
        }
      });
      
      // Sign transaksi
      transaction.sign(keyPair);
      
      // Proses transaksi
      const processResult = await this.processTransaction(transaction);
      
      if (processResult.success) {
        // Catat transaksi di history service
        const historyResult = await TransactionHistoryService.recordProductCreation(
          productId,
          fromUserId,
          productData
        );
        
        if (historyResult.success && historyResult.transactionId) {
          // Update blockchain details in transaction history
          await this.updateTransactionWithBlockchainInfo(
            historyResult.transactionId,
            "pending", // Block hash belum tersedia sampai ditambahkan ke blok
            transaction.getHash()
          );
          
          return {
            success: true,
            transactionHash: transaction.getHash()
          };
        }
      }
      
      return { success: false };
    } catch (error) {
      console.error("Error recording product creation to blockchain:", error);
      return { success: false };
    }
  }
  
  /**
   * Mencatat transaksi transfer produk ke blockchain
   * @param productId ID produk
   * @param fromUserId ID pengguna pemilik saat ini
   * @param toUserId ID pengguna pemilik baru
   * @param fromRole Peran pengguna pemilik saat ini
   * @param toRole Peran pengguna pemilik baru
   * @param privateKey Kunci private untuk signing transaksi
   * @param details Rincian transfer
   * @returns Hasil pembuatan transaksi
   */
  public async recordProductTransfer(
    productId: string,
    fromUserId: string,
    toUserId: string,
    fromRole: UserRole,
    toRole: UserRole,
    privateKey: string,
    details: any
  ): Promise<{ success: boolean; transactionHash?: string; blockHash?: string }> {
    try {
      // Buat key pair dari private key
      const keyPair = getKeyPair(privateKey);
      const fromPublicKey = keyPair.getPublic("hex");
      
      // Dapatkan public key penerima (to)
      // Dalam sistem nyata, ini harus diambil dari database
      const toPublicKey = details.toPublicKey || "default_public_key_for_" + toUserId;
      
      // Buat transaksi blockchain
      const transaction = new Transaction({
        from: fromPublicKey,
        to: toPublicKey,
        data: {
          type: "PRODUCT_TRANSFER",
          productId,
          fromUserId,
          toUserId,
          details
        }
      });
      
      // Sign transaksi
      transaction.sign(keyPair);
      
      // Proses transaksi
      const processResult = await this.processTransaction(transaction);
      
      if (processResult.success) {
        // Catat transaksi di history service
        const historyResult = await TransactionHistoryService.recordProductTransfer(
          productId,
          fromUserId,
          fromRole,
          toUserId,
          toRole,
          details
        );
        
        if (historyResult.success && historyResult.transactionId) {
          // Update blockchain details in transaction history
          await this.updateTransactionWithBlockchainInfo(
            historyResult.transactionId,
            "pending", // Block hash belum tersedia sampai ditambahkan ke blok
            transaction.getHash()
          );
          
          return {
            success: true,
            transactionHash: transaction.getHash()
          };
        }
      }
      
      return { success: false };
    } catch (error) {
      console.error("Error recording product transfer to blockchain:", error);
      return { success: false };
    }
  }
  
  /**
   * Mencatat transaksi verifikasi produk ke blockchain
   * @param productId ID produk
   * @param verifierId ID pengguna verifikator
   * @param verifierRole Peran pengguna verifikator
   * @param privateKey Kunci private untuk signing transaksi
   * @param passed Apakah verifikasi berhasil
   * @param details Rincian verifikasi
   * @returns Hasil pembuatan transaksi
   */
  public async recordProductVerification(
    productId: string,
    verifierId: string,
    verifierRole: UserRole,
    privateKey: string,
    passed: boolean,
    details: any
  ): Promise<{ success: boolean; transactionHash?: string; blockHash?: string }> {
    try {
      // Buat key pair dari private key
      const keyPair = getKeyPair(privateKey);
      const fromPublicKey = keyPair.getPublic("hex");
      
      // Buat transaksi blockchain
      const transaction = new Transaction({
        from: fromPublicKey,
        to: fromPublicKey, // Verifikasi dari dan untuk pengguna yang sama (verifier)
        data: {
          type: "PRODUCT_VERIFICATION",
          productId,
          verifierId,
          verificationPassed: passed,
          details
        }
      });
      
      // Sign transaksi
      transaction.sign(keyPair);
      
      // Proses transaksi
      const processResult = await this.processTransaction(transaction);
      
      if (processResult.success) {
        // Catat transaksi di history service
        const historyResult = await TransactionHistoryService.recordProductVerification(
          productId,
          verifierId,
          verifierRole,
          passed,
          details
        );
        
        if (historyResult.success && historyResult.transactionId) {
          // Update blockchain details in transaction history
          await this.updateTransactionWithBlockchainInfo(
            historyResult.transactionId,
            "pending", // Block hash belum tersedia sampai ditambahkan ke blok
            transaction.getHash()
          );
          
          return {
            success: true,
            transactionHash: transaction.getHash()
          };
        }
      }
      
      return { success: false };
    } catch (error) {
      console.error("Error recording product verification to blockchain:", error);
      return { success: false };
    }
  }

  /**
   * Helper method to update a transaction record with blockchain information
   */
  private async updateTransactionWithBlockchainInfo(
    transactionId: string, 
    blockHash: string, 
    transactionHash: string
  ): Promise<void> {
    try {
      // Get the transaction record
      const txRecord = await TransactionHistoryService.getTransaction(transactionId);
      
      if (txRecord) {
        // This is a workaround since we don't have direct access to update the blockchain info
        // In a real application, you would use an API endpoint or service method
        console.log(`Updating transaction ${transactionId} with blockchain data`);
        console.log(`Block hash: ${blockHash}, Transaction hash: ${transactionHash}`);
      } else {
        console.error(`Transaction ${transactionId} not found for blockchain update`);
      }
    } catch (error) {
      console.error(`Error updating blockchain info for transaction ${transactionId}:`, error);
    }
  }

  /**
   * Meminta mining dilakukan secara manual
   * @returns Status mining
   */
  public async triggerManualMining(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.miningService.mineTransactions();
      if (result) {
        return {
          success: true,
          message: "Mining berhasil dilakukan"
        };
      } else {
        return {
          success: false,
          message: "Mining gagal atau tidak ada transaksi yang cukup untuk di-mining"
        };
      }
    } catch (error) {
      console.error("Error saat melakukan mining manual:", error);
      return {
        success: false,
        message: "Terjadi kesalahan saat mining: " + (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * Mendapatkan jumlah transaksi tertunda
   * @returns Jumlah transaksi tertunda
   */
  public getPendingTransactionsCount(): number {
    return this.miningService.getPendingTransactionsCount();
  }
}

export default BlockchainIntegration; 