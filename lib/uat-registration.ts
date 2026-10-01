export const UAT_TEST_PHONE = /^\+276000000\d{2}$/;
export function validUatRegistration(body:{phone?:unknown;password?:unknown;code?:unknown}){
 return typeof body.phone==='string'&&UAT_TEST_PHONE.test(body.phone)&&typeof body.password==='string'&&body.password.length>=12&&new TextEncoder().encode(body.password).length<=72&&!/^Ss![a-f0-9]{64}$/.test(body.password)&&body.code==='123456';
}
