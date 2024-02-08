const puppeteer = require('puppeteer');
const readlineSync = require('readline-sync');

let browser; // Variabel untuk menyimpan sesi browser
let activePage; // Variabel untuk menyimpan halaman aktif

async function loginTelkomsel() {
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  // Buka halaman login Telkomsel
  await page.goto('https://my.telkomsel.com/web', { waitUntil: 'networkidle2' });

  // Tunggu hingga tombol "Lanjutkan di Web" muncul dan klik jika tersedia
  const continueButton = await page.waitForSelector('[data-testid=button].Button__style__neutral');
  if (continueButton) {
    await continueButton.click();
    // Tunggu sedikit untuk memberikan waktu bagi halaman untuk memuat elemen berikutnya
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Tunggu hingga input nomor Telkomsel muncul
  const phoneNumberInput = await page.waitForSelector('#loginMsisdnInput');
  if (!phoneNumberInput) {
    console.log('Gagal menemukan input nomor Telkomsel');
    await browser.close();
    return;
  }

  // Meminta nomor Telkomsel dari pengguna
  const phoneNumber = readlineSync.question('Masukkan nomor Telkomsel Anda: ');

  // Masukkan nomor Telkomsel ke dalam input
  await phoneNumberInput.type(phoneNumber);

  // Klik tombol "Masuk"
  await page.click('[data-testid=loginBtn]');

  // Tunggu hingga halaman berpindah ke halaman untuk memasukkan OTP
  await page.waitForSelector('.BottomSheet__style__modalWrapper');

  // Meminta OTP dari pengguna
  const otp = readlineSync.question('Masukkan OTP yang telah dikirimkan ke nomor ' + phoneNumber + ': ');

  // Masukkan OTP ke dalam input
  const otpInputs = await page.$$('.LoginOTP__style__inputStyle');
  for (let i = 0; i < otp.length; i++) {
    await otpInputs[i].type(otp[i]);
  }

  // Klik tombol "Submit"
  await page.click('[data-testid=btn]');

  // Tunggu hingga login selesai dan halaman utama muncul
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  // Set halaman aktif setelah login berhasil
  activePage = page;

  // Simpan sesi browser setelah login berhasil
  return browser;
}

async function checkMultimediaQuota(page) {
  try {
    // Buka halaman detail kuota multimedia
    await page.goto('https://my.telkomsel.com/detail-quota/multimedia', { waitUntil: 'networkidle2' });

    // Tunggu hingga detail kuota multimedia muncul
    await page.waitForSelector('.QuotaDetail__style__totalQuota');

    // Ambil informasi kuota multimedia
    const remainingQuotaElement = await page.$('.QuotaDetail__style__t1[style="color: rgb(78, 87, 100);"]');
    const remainingQuota = await page.evaluate(element => element.textContent.trim(), remainingQuotaElement);

    // Tampilkan informasi kuota dalam CLI
    console.log('Detail Kuota Multimedia:');
    console.log(remainingQuota);

    // Periksa kondisi kuota
    const quotaParts = remainingQuota.split('/');
    const quotaRemaining = parseFloat(quotaParts[0].trim());
    const quotaTotal = parseFloat(quotaParts[1].trim());
    
    if (quotaRemaining < 2) {
      // Kuota kurang dari 2 GB, lanjutkan pembelian kuota
      console.log('Kuota di bawah 2 GB, memulai pembelian kuota...');
      // Akses halaman pembelian kuota
      await page.goto('https://my.telkomsel.com/app/package-details/d57bc38dbf6676c04fdd6f69c8dfe2a2', { waitUntil: 'networkidle2' });
      // Tunggu hingga tombol "Beli" muncul dan klik
      await page.waitForSelector('[data-testid=btn].Button__style__primary');
      await page.click('[data-testid=btn].Button__style__primary');
      // Tunggu hingga halaman pembayaran muncul
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
      // Tunggu hingga opsi pembayaran muncul
      await page.waitForSelector('.PaymentItem__style__paymentItem');

      // Klik opsi pembayaran (misalnya, menggunakan pulsa)
      const paymentOption = await page.$('.PaymentItem__style__paymentItem');
      await paymentOption.click();

      // Tunggu sebentar untuk memastikan proses klik selesai
      await page.waitForTimeout(1000);

      // Klik tombol "Bayar"
      const payButton = await page.waitForSelector('[data-testid=actionButtonBtn].Button__style__primary');
      await payButton.click();
    }
  } catch (error) {
    console.error('Terjadi kesalahan:', error);
  }
}

(async () => {
  // Login dan dapatkan sesi browser
  browser = await loginTelkomsel();

  // Set interval untuk memeriksa kuota setiap 10 menit
  setInterval(async () => {
    await checkMultimediaQuota(activePage); // Gunakan halaman aktif untuk pengecekan
  }, 1 * 60 * 1000);
})();
