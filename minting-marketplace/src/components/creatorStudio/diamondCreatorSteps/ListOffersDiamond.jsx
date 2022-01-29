import { useState, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux';
import FixedBottomNavigation from '../FixedBottomNavigation.jsx';
import { useParams, useHistory } from 'react-router-dom';
import Swal from 'sweetalert2';
import chainData from '../../../utils/blockchainData.js'
import WorkflowContext from '../../../contexts/CreatorWorkflowContext.js';
import { metamaskCall } from '../../../utils/metamaskUtils.js';
import DiamondOfferRow from './diamondOfferRow.jsx';

const ListOffers = ({contractData, setStepNumber, steps, simpleMode, stepNumber, switchBlockchain, gotoNextStep}) => {
	const [offerList, setOfferList] = useState([]);
	const [forceRerender, setForceRerender] = useState(false);
	const [onMyChain, setOnMyChain] = useState();

	const { programmaticProvider, currentChain } = useSelector(store => store.contractStore);
	const {primaryColor, textColor} = useSelector(store => store.colorStore);
	const { collectionIndex } = useParams();

	useEffect(() => {
		setOfferList(contractData?.product?.offers ? contractData?.product?.offers : []);
	}, [contractData])

	useEffect(() => {
		setStepNumber(stepNumber);
	}, [setStepNumber, stepNumber])

	const rerender = useCallback(() => {
		setForceRerender(() => !forceRerender);
	}, [setForceRerender, forceRerender])

	const addOffer = (data) => {
		let aux = [...offerList];
		let startingToken = offerList.length === 0 ? 0 : Number(offerList.at(-1)?.range?.at(1)) + 1
		aux.push({
			offerName: '',
			range: [startingToken, startingToken],
			price: 0,
			tokensAllowed: 0,
			lockedTokens: 0,
		});
		setOfferList(aux);
	}

	const deleter = (index) => {
		let aux = [...offerList];
		if (aux.length > 1 && index !== aux.length - 1) {
			aux[1].starts = 0;
		}
		aux.splice(index, 1);
		setOfferList(aux);
	}
	const history = useHistory();

	const createOffers = async () => {
		try {
			Swal.fire({
				title: 'Creating offer...',
				html: 'Please wait...',
				icon: 'info',
				showConfirmButton: false
			});
			if (await metamaskCall(
				contractData.diamond.createRangeBatch(
					collectionIndex,
					offerList.filter(item => item.fixed !== true).map(item => {
						return {
							rangeStart: item.range[0],
							rangeEnd: item.range[1],
							tokensAllowed: item.tokensAllowed,
							lockedTokens: item.lockedTokens,
							price: item.price,
							name: item.offerName
						}
					})
				)
			)) {
				Swal.fire({
					title: 'Success!',
					html: 'The offer(s) have been created!',
					icon: 'success',
					showConfirmButton: true
				});
				gotoNextStep();
			}
		} catch (err) {
			console.error(err)
			Swal.fire('Error',err?.data?.message ? err?.data?.message : 'An error has occurred','error');
			return;
		}
	}

	const appendOffers = async () => {
		try {
			Swal.fire({
				title: 'Appending offers...',
				html: 'Please wait...',
				icon: 'info',
				showConfirmButton: false
			});
			await (await contractData.diamond.appendOfferRangeBatch(
				contractData.product.offers[0].offerPool,
				offerList.map((item, index, array) => (index === 0) ? 0 : array[index - 1].range[0]),
				offerList.map((item) => item.range[1]),
				offerList.map((item) => item.price),
				offerList.map((item) => item.offerName))
			).wait();
			Swal.fire({
				title: 'Success!',
				html: 'The offers have been appended!',
				icon: 'success',
				showConfirmButton: true
			});
		} catch (err) {
			console.error(err)
			Swal.fire('Error',err?.data?.message ? err?.data?.message : 'An error has occurred','error');
			return;
		}
	}

	useEffect(() => {
		setOnMyChain(
			window.ethereum ?
				chainData[contractData?.blockchain]?.chainId === window.ethereum.chainId
				:
				chainData[contractData?.blockchain]?.chainId === programmaticProvider?.provider?._network?.chainId
			)
	}, [contractData, programmaticProvider, currentChain])

	return <div className='row px-0 mx-0'>
		{contractData ? <>
			{offerList?.length !== 0 && <div className='row w-100 text-start px-0 mx-0'>
					{offerList.map((item, index, array) => {
						return <DiamondOfferRow
							array={array}
							deleter={e => deleter(index)}
							key={index}
							index={index}
							{...item}
							blockchainSymbol={chainData[contractData?.blockchain]?.symbol}
							rerender={rerender}
							simpleMode={simpleMode}
							maxCopies={Number(contractData?.product?.copies) - 1} />
					})}
			</div>}
			<div className='col-12 mt-3 text-center'>
				<div className='border-stimorol rounded-rair'>
					<button onClick={addOffer} disabled={contractData === undefined || offerList.length >= 12 || offerList?.at(-1)?.range[1] >= (Number(contractData?.product?.copies) - 1)} className={`btn btn-${primaryColor} rounded-rair px-4`}>
						Add new <i className='fas fa-plus' style={{border: `solid 1px ${textColor}`, borderRadius: '50%', padding: '5px'}} />
					</button>
				</div>
			</div>
			<div className='col-12 mt-3 p-5 text-center rounded-rair' style={{border: 'dashed 2px var(--charcoal-80)'}}>
				First Token: {contractData?.product?.firstTokenIndex}, Last Token: {contractData?.product?.firstTokenIndex + contractData?.product?.copies - 1}, Mintable Tokens Left: {contractData?.product?.copies - contractData?.product?.soldCopies}
			</div>
			{chainData && <FixedBottomNavigation
				backwardFunction={() => {
					history.goBack()
				}}
				forwardFunctions={[{
					action: !onMyChain ?
						switchBlockchain
						:
						(offerList[0]?.fixed ?
							(offerList.filter(item => item.fixed !== true).length === 0 ? 
								gotoNextStep
								:
								createOffers)
							:
							createOffers),
					label: !onMyChain ?
						`Switch to ${chainData[contractData?.blockchain]?.name}`
						:
						(offerList[0]?.fixed ?
							(offerList.filter(item => item.fixed !== true).length === 0 ?
								'Continue'
								:
								'Append Ranges')
							:
							'Create Ranges'),
					disabled: (
						offerList.length === 0 ||
						offerList.at(-1).range[1] > Number(contractData.product.copies) - 1 ||
						offerList.reduce((current, item) => {
							return current || item.offerName === ''
						}, false)
					)
				}]}
			/>}
		</> : 'Fetching data...'}
	</div>
}

const ContextWrapper = (props) => {
	return <WorkflowContext.Consumer> 
		{(value) => {
			return <ListOffers {...value} {...props} />
		}}
	</WorkflowContext.Consumer>
}

export default ContextWrapper;