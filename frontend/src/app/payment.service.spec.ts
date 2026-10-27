import { TestBed } from '@angular/core/testing';
import { PaymentService, RazorpayWrapper } from './payment.service';

describe('PaymentService',()=>{
 it('opens Checkout with the API order values through the mocked wrapper',async()=>{const wrapper={open:jasmine.createSpy('open')};TestBed.configureTestingModule({providers:[PaymentService,{provide:RazorpayWrapper,useValue:wrapper}]});const service=TestBed.inject(PaymentService);spyOn(service,'load').and.resolveTo();const order={keyId:'rzp_test_from_api',orderId:'order_123',amount:5000,currency:'INR'};const success=jasmine.createSpy('success');const dismiss=jasmine.createSpy('dismiss');await service.open(order,success,dismiss);expect(wrapper.open).toHaveBeenCalledWith({key:order.keyId,order_id:order.orderId,amount:5000,currency:'INR',handler:success,modal:{ondismiss:dismiss}});});
});
